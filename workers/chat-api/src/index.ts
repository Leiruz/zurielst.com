/**
 * zurielst-chat-api scaffold (M2). The full chat pipeline lands in M6; this
 * skeleton already enforces the request preflight contract from plan rev 3 so
 * the routing surface and its tests exist from day one:
 *   exact host + exact path -> 404; method -> 405; otherwise 503 until launch.
 * No AI call, no budget spend, nothing streamed yet.
 */

export interface Env {
  AI: unknown;
  DAILY_BUDGET: DurableObjectNamespace;
  DAILY_CAP: string;
  ALLOWED_HOSTS: string;
}

const CHAT_PATH = '/api/chat';

function json(status: number, body: Record<string, unknown>, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const allowedHosts = env.ALLOWED_HOSTS.split(',').map((h) => h.trim());
    const isDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    if (!isDev && !allowedHosts.includes(url.hostname)) {
      return json(404, { error: 'Not found.' });
    }
    if (url.pathname !== CHAT_PATH) {
      return json(404, { error: 'Not found.' });
    }
    if (request.method !== 'POST') {
      return json(405, { error: 'Method not allowed.' }, { allow: 'POST' });
    }
    // M6 replaces this with: content checks, byte ceilings, same-origin policy,
    // schema, normalization, injection filter, rate limit, DO reservation,
    // model call, buffered guard, SSE replay.
    return json(503, { error: 'The assistant launches with the site rebuild.' });
  },
};

/** Minimal Durable Object shell; real reservation logic arrives in M6. */
export class DailyBudget {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(): Promise<Response> {
    return new Response(JSON.stringify({ error: 'Not launched.' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
