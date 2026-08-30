export type ChatRole = 'system' | 'user';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface AiRequest {
  messages: ChatMessage[];
  stream: false;
  max_tokens: 384;
  temperature: 0.3;
}

interface AiRunOptions {
  signal: AbortSignal;
}

export interface AiBinding {
  run(model: string, input: AiRequest, options: AiRunOptions): Promise<unknown>;
}

const MODELS = [
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/meta/llama-3.2-1b-instruct',
] as const;

function responseText(result: unknown): string | null {
  if (result === null || typeof result !== 'object' || !('response' in result)) {
    return null;
  }
  return typeof result.response === 'string' && result.response.length > 0
    ? result.response
    : null;
}

export async function runChatCompletion(
  ai: AiBinding,
  messages: ChatMessage[],
): Promise<string | null> {
  for (const model of MODELS) {
    try {
      const result = await ai.run(
        model,
        {
          messages,
          stream: false,
          max_tokens: 384,
          temperature: 0.3,
        },
        { signal: AbortSignal.timeout(25_000) },
      );
      const response = responseText(result);
      if (response !== null) return response;
    } catch {
      // The next loop iteration is the one permitted fallback attempt.
    }
  }
  return null;
}
