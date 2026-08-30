import { SELF, env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UNAVAILABLE_REPLY } from '../src/index';

const BASE = 'https://zurielst.com';

describe('chat-api preflight contract', () => {
  beforeEach(() => {
    vi.spyOn(env.AI, 'run').mockRejectedValue(new Error('Unconfigured AI test double'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('404s unknown paths without invoking anything else', async () => {
    const res = await SELF.fetch(`${BASE}/api/other`);
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
    await expect(res.json()).resolves.toEqual({ answer: expect.any(String) });
  });

  it('404s the right path on a host outside the allowlist', async () => {
    const res = await SELF.fetch('https://evil.example/api/chat', { method: 'POST' });
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
    await expect(res.json()).resolves.toEqual({ answer: expect.any(String) });
  });

  it('405s non-POST on the chat path with an Allow header', async () => {
    const res = await SELF.fetch(`${BASE}/api/chat`);
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
    expect(res.headers.get('cache-control')).toBe('no-store');
    await expect(res.json()).resolves.toEqual({ answer: expect.any(String) });
  });

  it('503s valid POSTs when both model attempts are unavailable, with no-store', async () => {
    vi.mocked(env.AI.run).mockRejectedValue(new Error('model unavailable'));
    const res = await SELF.fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '192.0.2.10',
      },
      body: JSON.stringify({ message: 'What does Zuriel do?' }),
    });
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    await expect(res.json()).resolves.toEqual({ answer: UNAVAILABLE_REPLY });
  });
});
