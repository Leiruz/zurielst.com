import { describe, expect, it } from 'vitest';

import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';

const structuredDataModule = await import('@/lib/structured-data').catch(() => ({}));
const profile = profileJson as Profile;

describe('profile structured data', () => {
  it('builds one linked Person, WebSite, and ProfilePage graph', () => {
    const createProfileStructuredData = Reflect.get(
      structuredDataModule,
      'createProfileStructuredData',
    ) as unknown;

    expect(createProfileStructuredData).toBeTypeOf('function');
    if (typeof createProfileStructuredData !== 'function') return;

    const buildDate = '2026-08-31T04:05:06.000Z';
    const data = createProfileStructuredData(profile, buildDate) as {
      '@context': string;
      '@graph': Array<Record<string, unknown>>;
    };

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@graph'].map((entry) => entry['@type'])).toEqual([
      'Person',
      'WebSite',
      'ProfilePage',
    ]);
    expect(data['@graph'][0]).toMatchObject({
      name: profile.identity.name,
      url: profile.meta.og.url,
      jobTitle: profile.identity.roles[0],
      sameAs: profile.identity.socials.map((social) => social.url),
    });
    expect(data['@graph'][2]).toMatchObject({
      dateModified: buildDate,
      mainEntity: { '@id': `${profile.meta.og.url}/#person` },
    });
  });
});
