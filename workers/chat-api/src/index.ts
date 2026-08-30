/**
 * zurielst-chat-api request pipeline. All model output is buffered and checked
 * before safe answers are replayed as JSON-framed server-sent events.
 */

import { runChatCompletion, type AiBinding } from './ai';
import { reserveDailyBudget, type DailyBudget as DailyBudgetObject } from './budget';
import { guardAnswer } from './guard';
import { findInjection } from './inject';
import { normalizeText } from './normalize';
import {
  MAX_SERIALIZED_PROMPT_BYTES,
  buildChatMessages,
  serializedPromptByteLength,
} from './prompt';
import { checkRateLimit, type RateLimitBinding } from './ratelimit';
import { ChatRequestSchema } from './schema';
import { createSseResponse } from './sse';

export interface Env {
  AI: AiBinding;
  DAILY_BUDGET: DurableObjectNamespace<DailyBudgetObject>;
  DAILY_CAP: string;
  ALLOWED_HOSTS: string;
  RATE_LIMITER: RateLimitBinding;
}

export const DEFLECTION_REPLY = "Nice try. I only answer questions about Zuriel's published profile. Ask me about his work, projects, or how to reach him.";
export const BUDGET_REPLY = 'The assistant has reached its daily conversation budget. It resets at midnight UTC. Meanwhile, everything I know is on this page, or email zurielst@u.nus.edu.';
export const UNAVAILABLE_REPLY = 'The assistant is unavailable right now. Everything it knows is on this page, or email zurielst@u.nus.edu.';
export const GUARD_REPLY = "I could not produce a safe answer for that. Ask me about Zuriel's published profile, or email zurielst@u.nus.edu.";

const CHAT_PATH = '/api/chat';
const MAX_BODY_BYTES = 8_192;
const PRODUCTION_ORIGINS = new Set([
  'https://zurielst.com',
  'https://staging.zurielst.com',
]);

const ERROR_REPLIES = {
  badRequest: 'Invalid chat request.',
  forbidden: 'Forbidden.',
  methodNotAllowed: 'Method not allowed.',
  notFound: 'Not found.',
  payloadTooLarge: 'Request body is too large.',
  rateLimited: 'Too many requests. Please try again shortly.',
  unsupportedMediaType: 'Content-Type must be application/json.',
} as const;

function json(status: number, answer: string, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify({ answer }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  });
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function isAllowedOrigin(request: Request, url: URL, localRequest: boolean): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite !== null) {
    return fetchSite.toLowerCase() === 'same-origin';
  }

  const origin = request.headers.get('origin');
  if (origin === null) {
    return localRequest;
  }
  if (PRODUCTION_ORIGINS.has(url.origin)) {
    return origin === url.origin;
  }
  if (!localRequest) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    return (originUrl.protocol === 'http:' || originUrl.protocol === 'https:')
      && isLocalHostname(originUrl.hostname)
      && isLocalHostname(url.hostname);
  } catch {
    return false;
  }
}

type BodyReadResult =
  | { ok: true; text: string }
  | { ok: false; tooLarge: boolean };

async function readBody(request: Request): Promise<BodyReadResult> {
  if (request.body === null) {
    return { ok: true, text: '' };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The byte ceiling still determines the response if cancellation fails.
        }
        return { ok: false, tooLarge: true };
      }
      chunks.push(result.value);
    }
  } catch {
    return { ok: false, tooLarge: false };
  }

  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(body) };
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const allowedHosts = env.ALLOWED_HOSTS.split(',').map((host) => host.trim());
    const localRequest = isLocalHostname(url.hostname);

    if (!localRequest && !allowedHosts.includes(url.hostname)) {
      return json(404, ERROR_REPLIES.notFound);
    }
    if (url.pathname !== CHAT_PATH) {
      return json(404, ERROR_REPLIES.notFound);
    }
    if (request.method !== 'POST') {
      return json(405, ERROR_REPLIES.methodNotAllowed, { allow: 'POST' });
    }

    const contentType = request.headers.get('content-type');
    const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
    if (mediaType !== 'application/json') {
      return json(415, ERROR_REPLIES.unsupportedMediaType);
    }

    const contentLength = request.headers.get('content-length');
    if (
      contentLength !== null
      && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)
    ) {
      return json(413, ERROR_REPLIES.payloadTooLarge);
    }

    const body = await readBody(request);
    if (!body.ok) {
      return body.tooLarge
        ? json(413, ERROR_REPLIES.payloadTooLarge)
        : json(400, ERROR_REPLIES.badRequest);
    }

    if (!isAllowedOrigin(request, url, localRequest)) {
      return json(403, ERROR_REPLIES.forbidden);
    }

    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(body.text);
    } catch {
      return json(400, ERROR_REPLIES.badRequest);
    }
    const parsed = ChatRequestSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return json(400, ERROR_REPLIES.badRequest);
    }

    const message = normalizeText(parsed.data.message);
    const normalizedMessageLength = Array.from(message).length;
    if (normalizedMessageLength < 1 || normalizedMessageLength > 500) {
      return json(400, ERROR_REPLIES.badRequest);
    }
    if (findInjection(message).matched) {
      return json(200, DEFLECTION_REPLY);
    }

    const chatMessages = buildChatMessages(message, parsed.data.history);
    if (serializedPromptByteLength(chatMessages) > MAX_SERIALIZED_PROMPT_BYTES) {
      return json(400, ERROR_REPLIES.badRequest);
    }

    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (!await checkRateLimit(env, ip)) {
      return json(429, ERROR_REPLIES.rateLimited, { 'retry-after': '30' });
    }

    const reservation = await reserveDailyBudget(env);
    if (!reservation.allowed) {
      return json(200, BUDGET_REPLY);
    }

    const answer = await runChatCompletion(
      env.AI,
      chatMessages,
    );
    if (answer === null) {
      return json(503, UNAVAILABLE_REPLY);
    }

    const guarded = guardAnswer(answer);
    if (!guarded.safe) {
      return json(200, GUARD_REPLY);
    }
    return createSseResponse(guarded.answer);
  },
};

export default worker;
export { DailyBudget } from './budget';
