import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CHAT_UNAVAILABLE_MESSAGE,
  requestChat,
} from '@/components/chat/chat-transport';

const encoder = new TextEncoder();

function streamResponse(chunks: string[]) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });

  return new Response(body, {
    headers: { 'content-type': 'text/event-stream; charset=utf-8' },
  });
}

function byteStreamResponse(chunks: Uint8Array[]) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

  return new Response(body, {
    headers: { 'content-type': 'text/event-stream; charset=utf-8' },
  });
}

function trackedOpenResponse(
  chunk: string,
  init: ResponseInit = {},
) {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(chunk));
    },
    cancel,
  });

  return {
    cancel,
    response: new Response(body, init),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chat transport', () => {
  it('posts the current message with only the last four prior turns', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ answer: 'Published profile answer.' }), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await requestChat({
      message: 'What is current?',
      history: [
        { role: 'user', content: 'one' },
        { role: 'assistant', content: 'two' },
        { role: 'user', content: 'three' },
        { role: 'assistant', content: 'four' },
        { role: 'user', content: 'five' },
      ],
      signal: new AbortController().signal,
      onDelta: vi.fn(),
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/chat');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({
      message: 'What is current?',
      history: [
        { role: 'assistant', content: 'two' },
        { role: 'user', content: 'three' },
        { role: 'assistant', content: 'four' },
        { role: 'user', content: 'five' },
      ],
    });
  });

  it('keeps history within 500 UTF-16 units without splitting a surrogate pair', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ answer: 'Published profile answer.' }), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await requestChat({
      message: 'Question',
      history: [
        { role: 'user', content: '   \n' },
        { role: 'assistant', content: `${'a'.repeat(499)}\u{1F600}tail` },
      ],
      signal: new AbortController().signal,
      onDelta: vi.fn(),
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      history: Array<{ content: string }>;
    };
    expect(body.history).toHaveLength(1);
    const historyContent = body.history[0]?.content ?? '';
    expect(historyContent.length).toBe(499);
    expect(Array.from(historyContent)).toHaveLength(499);
  });

  it('preserves a terminal high surrogate when truncation did not split a pair', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ answer: 'Published profile answer.' }), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await requestChat({
      message: 'Question',
      history: [{ role: 'user', content: '\uD800' }],
      signal: new AbortController().signal,
      onDelta: vi.fn(),
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      history: Array<{ content: string }>;
    };
    expect(body.history[0]?.content).toBe('\uD800');
  });

  it('parses split SSE frames, keeps event text inert, and stops at done', async () => {
    const multibyteDelta = 'Zuriel says \u{1F600} ';
    const payload = [
      `data: ${JSON.stringify({ delta: multibyteDelta })}\r\n\r\n`,
      `data: ${JSON.stringify({ delta: 'event: evil' })}\n\n`,
      `data: ${JSON.stringify({ done: true })}\n\n`,
      `data: ${JSON.stringify({ delta: ' must be ignored' })}\n\n`,
    ].join('');
    const bytes = encoder.encode(payload);
    const emojiIndex = payload.indexOf('\u{1F600}');
    const splitInsideEmoji = encoder.encode(payload.slice(0, emojiIndex)).length + 1;
    const splitAt = encoder.encode(payload.slice(0, payload.indexOf('event: evil') + 4)).length;
    const fetchMock = vi.fn().mockResolvedValue(
      byteStreamResponse([
        bytes.slice(0, splitInsideEmoji),
        bytes.slice(splitInsideEmoji, splitAt),
        bytes.slice(splitAt),
      ]),
    );
    const deltas: string[] = [];
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestChat({
      message: 'Tell me about Zuriel.',
      history: [],
      signal: new AbortController().signal,
      onDelta: (delta) => deltas.push(delta),
    });

    expect(deltas).toEqual([multibyteDelta, 'event: evil']);
    expect(result).toEqual({
      answer: `${multibyteDelta}event: evil`,
      retryAfterSeconds: 0,
      streamed: true,
    });
  });

  it('returns canned JSON answers from non-success statuses', async () => {
    const answer = 'Invalid chat request.';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ answer }), {
          status: 400,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }),
      ),
    );

    await expect(
      requestChat({
        message: 'Question',
        history: [],
        signal: new AbortController().signal,
        onDelta: vi.fn(),
      }),
    ).resolves.toEqual({ answer, retryAfterSeconds: 0, streamed: false });
  });

  it('reads retry-after from a 429 JSON response', async () => {
    const answer = 'Too many requests. Please try again shortly.';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ answer }), {
          status: 429,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'retry-after': '2',
          },
        }),
      ),
    );

    await expect(
      requestChat({
        message: 'Question',
        history: [],
        signal: new AbortController().signal,
        onDelta: vi.fn(),
      }),
    ).resolves.toEqual({ answer, retryAfterSeconds: 2, streamed: false });
  });

  it('preserves a bounded retry countdown when a 429 body cannot be parsed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not json', {
          status: 429,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'retry-after': '999999999999999999999999999999999999999999',
          },
        }),
      ),
    );

    await expect(
      requestChat({
        message: 'Question',
        history: [],
        signal: new AbortController().signal,
        onDelta: vi.fn(),
      }),
    ).resolves.toEqual({
      answer: CHAT_UNAVAILABLE_MESSAGE,
      retryAfterSeconds: 3_600,
      streamed: false,
    });
  });

  it('does not treat an error status labeled as SSE as a successful stream', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          `data: ${JSON.stringify({ delta: '<script>wrong protocol</script>' })}\n\n`
            + `data: ${JSON.stringify({ done: true })}\n\n`,
          {
            status: 429,
            headers: {
              'content-type': 'text/event-stream; charset=utf-8',
              'retry-after': '30',
            },
          },
        ),
      ),
    );
    const onDelta = vi.fn();

    const result = await requestChat({
      message: 'Question',
      history: [],
      signal: new AbortController().signal,
      onDelta,
    });

    expect(onDelta).not.toHaveBeenCalled();
    expect(result).toEqual({
      answer: CHAT_UNAVAILABLE_MESSAGE,
      retryAfterSeconds: 30,
      streamed: false,
    });
  });

  it('maps an unattached 404 route to the local unavailable reply', async () => {
    const { cancel, response } = trackedOpenResponse(
      '<!doctype html><p>Not found</p>',
      {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      },
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response),
    );

    const result = await requestChat({
      message: 'Question',
      history: [],
      signal: new AbortController().signal,
      onDelta: vi.fn(),
    });

    expect(result.answer).toBe(CHAT_UNAVAILABLE_MESSAGE);
    expect(result.streamed).toBe(false);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('cancels an open stream after a malformed SSE frame', async () => {
    const { cancel, response } = trackedOpenResponse(
      'data: {not json}\n\n',
      { headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const result = await requestChat({
      message: 'Question',
      history: [],
      signal: new AbortController().signal,
      onDelta: vi.fn(),
    });

    expect(result.answer).toBe(CHAT_UNAVAILABLE_MESSAGE);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('rejects an oversized unterminated SSE frame before later data', async () => {
    const oversizedPrefix = `data: ${' '.repeat(65_537)}`;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        streamResponse([
          oversizedPrefix,
          `${JSON.stringify({ done: true })}\n\n`,
        ]),
      ),
    );

    await expect(
      requestChat({
        message: 'Question',
        history: [],
        signal: new AbortController().signal,
        onDelta: vi.fn(),
      }),
    ).resolves.toEqual({
      answer: CHAT_UNAVAILABLE_MESSAGE,
      retryAfterSeconds: 0,
      streamed: false,
    });
  });

  it('rejects streamed answers beyond the frozen API response limit', async () => {
    const onDelta = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        streamResponse([
          `data: ${JSON.stringify({ delta: 'a'.repeat(4_001) })}\n\n`,
          `data: ${JSON.stringify({ done: true })}\n\n`,
        ]),
      ),
    );

    const result = await requestChat({
      message: 'Question',
      history: [],
      signal: new AbortController().signal,
      onDelta,
    });

    expect(onDelta).not.toHaveBeenCalled();
    expect(result.answer).toBe(CHAT_UNAVAILABLE_MESSAGE);
    expect(result.streamed).toBe(false);
  });

  it('bounds the number of streamed delta frames', async () => {
    const onDelta = vi.fn();
    const frames = Array.from(
      { length: 129 },
      () => `data: ${JSON.stringify({ delta: 'a' })}\n\n`,
    );
    frames.push(`data: ${JSON.stringify({ done: true })}\n\n`);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(frames)));

    const result = await requestChat({
      message: 'Question',
      history: [],
      signal: new AbortController().signal,
      onDelta,
    });

    expect(onDelta).toHaveBeenCalledTimes(128);
    expect(result.answer).toBe(CHAT_UNAVAILABLE_MESSAGE);
    expect(result.streamed).toBe(false);
  });

  it('reports a parse failure after delivering only complete prior deltas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        streamResponse([
          `data: ${JSON.stringify({ delta: 'Validated partial text.' })}\n\n`,
          'data: {not json}\n\n',
        ]),
      ),
    );
    const deltas: string[] = [];

    const result = await requestChat({
      message: 'Question',
      history: [],
      signal: new AbortController().signal,
      onDelta: (delta) => deltas.push(delta),
    });

    expect(deltas).toEqual(['Validated partial text.']);
    expect(result.answer).toBe(CHAT_UNAVAILABLE_MESSAGE);
    expect(result.streamed).toBe(false);
  });

  it.each([
    ['network failure', () => Promise.reject(new TypeError('offline'))],
    [
      'JSON parse failure',
      () => Promise.resolve(
        new Response('not json', {
          status: 503,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }),
      ),
    ],
    [
      'SSE parse failure',
      () => Promise.resolve(streamResponse(['data: {not json}\n\n'])),
    ],
  ])('uses the local unavailable reply after a %s', async (_name, response) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(response));

    const result = await requestChat({
      message: 'Question',
      history: [],
      signal: new AbortController().signal,
      onDelta: vi.fn(),
    });

    expect(result).toEqual({
      answer: CHAT_UNAVAILABLE_MESSAGE,
      retryAfterSeconds: 0,
      streamed: false,
    });
  });
});
