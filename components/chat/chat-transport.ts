export const CHAT_UNAVAILABLE_MESSAGE = 'The assistant is unavailable right now. Everything it knows is on this page, or email zurielst@u.nus.edu.';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequestResult {
  answer: string;
  retryAfterSeconds: number;
  streamed: boolean;
}

interface ChatRequestOptions {
  message: string;
  history: ChatTurn[];
  signal: AbortSignal;
  onDelta(delta: string): void;
}

type SsePayload = { delta: string } | { done: true };
const MAX_RETRY_AFTER_SECONDS = 3_600;
const MAX_SSE_ANSWER_CHARACTERS = 4_000;
const MAX_PENDING_SSE_FRAME_UNITS = 65_536;
const MAX_SSE_DELTA_FRAMES = 128;

function unavailableResult(retryAfterSeconds = 0): ChatRequestResult {
  return {
    answer: CHAT_UNAVAILABLE_MESSAGE,
    retryAfterSeconds,
    streamed: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === 'AbortError';
}

function truncateToUtf16Units(value: string, limit: number): string {
  const truncated = value.slice(0, limit);
  const lastUnit = truncated.charCodeAt(truncated.length - 1);
  const nextUnit = value.charCodeAt(limit);
  const splitSurrogatePair = value.length > limit
    && lastUnit >= 0xD800
    && lastUnit <= 0xDBFF
    && nextUnit >= 0xDC00
    && nextUnit <= 0xDFFF;
  return splitSurrogatePair
    ? truncated.slice(0, -1)
    : truncated;
}

function requestHistory(history: ChatTurn[]): ChatTurn[] {
  return history
    .map((turn) => ({ role: turn.role, content: turn.content.trim() }))
    .filter((turn) => turn.content.length > 0)
    .slice(-4)
    .map((turn) => ({
      role: turn.role,
      content: truncateToUtf16Units(turn.content, 500),
    }));
}

export function parseRetryAfter(value: string | null, now = Date.now()): number {
  if (value === null) return 0;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds)
      ? Math.min(seconds, MAX_RETRY_AFTER_SECONDS)
      : MAX_RETRY_AFTER_SECONDS;
  }

  const retryDate = Date.parse(trimmed);
  if (!Number.isFinite(retryDate)) return 0;
  return Math.min(
    MAX_RETRY_AFTER_SECONDS,
    Math.max(0, Math.ceil((retryDate - now) / 1_000)),
  );
}

function parseSsePayload(frame: string): SsePayload | null {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n');

  if (data.length === 0) return null;
  const parsed: unknown = JSON.parse(data);
  if (!isRecord(parsed)) throw new TypeError('Invalid SSE payload');
  if (parsed.done === true) return { done: true };
  if (typeof parsed.delta === 'string') return { delta: parsed.delta };
  throw new TypeError('Invalid SSE payload');
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try {
    await reader.cancel();
  } catch {
    // The terminal done frame already completed the response.
  }
}

async function cancelResponseBody(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // Cancellation is best effort after a response has already failed validation.
  }
}

async function readSseAnswer(
  response: Response,
  onDelta: (delta: string) => void,
): Promise<string> {
  if (response.body === null) throw new TypeError('Missing SSE response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  let answerCharacters = 0;
  let deltaFrames = 0;

  try {
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      if (buffer.length > MAX_PENDING_SSE_FRAME_UNITS) {
        throw new TypeError('SSE frame exceeds the client limit');
      }

      while (true) {
        const boundary = /\r?\n\r?\n/.exec(buffer);
        if (boundary === null || boundary.index === undefined) break;

        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const payload = parseSsePayload(frame);
        if (payload === null) continue;
        if ('done' in payload) return answer;

        deltaFrames += 1;
        if (deltaFrames > MAX_SSE_DELTA_FRAMES) {
          throw new TypeError('SSE response has too many delta frames');
        }
        const deltaCharacters = Array.from(payload.delta).length;
        if (answerCharacters + deltaCharacters > MAX_SSE_ANSWER_CHARACTERS) {
          throw new TypeError('SSE answer exceeds the client limit');
        }
        answer += payload.delta;
        answerCharacters += deltaCharacters;
        onDelta(payload.delta);
      }

      if (chunk.done) throw new TypeError('SSE response ended before its done frame');
    }
  } finally {
    await cancelReader(reader);
  }
}

async function readJsonAnswer(response: Response): Promise<string> {
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.answer !== 'string') {
    throw new TypeError('Invalid JSON chat response');
  }
  return body.answer;
}

export async function requestChat({
  message,
  history,
  signal,
  onDelta,
}: ChatRequestOptions): Promise<ChatRequestResult> {
  let retryAfterSeconds = 0;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, history: requestHistory(history) }),
      signal,
    });

    if (response.status === 404) {
      await cancelResponseBody(response);
      return unavailableResult();
    }
    if (response.status === 429) {
      retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'));
    }

    const mediaType = response.headers
      .get('content-type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase();

    if (mediaType === 'text/event-stream') {
      if (!response.ok) {
        await cancelResponseBody(response);
        throw new TypeError('SSE chat response has an error status');
      }
      return {
        answer: await readSseAnswer(response, onDelta),
        retryAfterSeconds,
        streamed: true,
      };
    }
    if (mediaType !== 'application/json') {
      await cancelResponseBody(response);
      throw new TypeError('Unexpected chat response content type');
    }

    return {
      answer: await readJsonAnswer(response),
      retryAfterSeconds,
      streamed: false,
    };
  } catch (error) {
    if (signal.aborted || isAbortError(error)) throw error;
    return unavailableResult(retryAfterSeconds);
  }
}
