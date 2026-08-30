import type { Profile } from '@/content/schema';

export function createProfileStructuredData(profile: Profile, buildDate: string) {
  const canonicalUrl = profile.meta.og.url.replace(/\/$/, '');
  const personId = `${canonicalUrl}/#person`;
  const websiteId = `${canonicalUrl}/#website`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': personId,
        name: profile.identity.name,
        url: canonicalUrl,
        jobTitle: profile.identity.roles[0],
        sameAs: profile.identity.socials.map((social) => social.url),
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: profile.identity.name,
        url: canonicalUrl,
        publisher: { '@id': personId },
      },
      {
        '@type': 'ProfilePage',
        '@id': `${canonicalUrl}/#profile`,
        name: profile.meta.title,
        url: canonicalUrl,
        dateModified: buildDate,
        mainEntity: { '@id': personId },
        isPartOf: { '@id': websiteId },
      },
    ],
  };
}
