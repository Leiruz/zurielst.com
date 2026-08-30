import { describe, expect, it } from 'vitest';

const outboundLinksModule = await import('@/lib/outbound-links').catch(() => ({}));

describe('outbound social tracking', () => {
  it('appends the site source while preserving an existing query', () => {
    const withSiteUtm = Reflect.get(outboundLinksModule, 'withSiteUtm') as unknown;

    expect(withSiteUtm).toBeTypeOf('function');
    if (typeof withSiteUtm !== 'function') return;

    expect(withSiteUtm('https://example.com/profile')).toBe(
      'https://example.com/profile?utm_source=zurielst.com',
    );
    expect(withSiteUtm('https://example.com/profile?tab=work')).toBe(
      'https://example.com/profile?tab=work&utm_source=zurielst.com',
    );
  });
});
