const encoder = new TextEncoder();
const CHUNK_SIZE = 40;

export interface SseOptions {
  delayMs?: number;
}

function frame(value: { delta: string } | { done: true }): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Replays a validated answer in JSON SSE data frames. */
export function createSseResponse(answer: string, options: SseOptions = {}): Response {
  const chunks = Array.from(answer).reduce<string[]>((all, character, index) => {
    const chunkIndex = Math.floor(index / CHUNK_SIZE);
    all[chunkIndex] = (all[chunkIndex] ?? '') + character;
    return all;
  }, []);
  const delayMs = options.delayMs ?? 12;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(frame({ delta: chunk }));
        if (delayMs > 0) {
          await delay(delayMs);
        }
      }
      controller.enqueue(frame({ done: true }));
      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
