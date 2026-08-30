import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const BASE = 'https://zurielst.com';

describe('chat-api preflight contract (scaffold)', () => {
  it('404s unknown paths without invoking anything else', async () => {
    const res = await SELF.fetch(`${BASE}/api/other`);
    expect(res.status).toBe(404);
  });

  it('404s the right path on a host outside the allowlist', async () => {
    const res = await SELF.fetch('https://evil.example/api/chat', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('405s non-POST on the chat path with an Allow header', async () => {
    const res = await SELF.fetch(`${BASE}/api/chat`);
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
  });

  it('503s valid POSTs until launch, with no-store', async () => {
    const res = await SELF.fetch(`${BASE}/api/chat`, { method: 'POST' });
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
