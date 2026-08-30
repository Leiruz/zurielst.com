import { describe, expect, it } from 'vitest';

import { CONSENT_TRANSLATIONS } from './consent-copy';

const description =
  'This site can count visits with one consent-gated measurement signal. No ads, no personalization, no third-party tracking. Decline and everything still works.';

describe('CONSENT_TRANSLATIONS', () => {
  it('uses the honest privacy wording in both consent surfaces', () => {
    expect(CONSENT_TRANSLATIONS.translations.en.cookieBanner).toEqual({
      title: 'Privacy choice',
      description,
    });
    expect(CONSENT_TRANSLATIONS.translations.en.consentManagerDialog).toEqual({
      title: 'Privacy choice',
      description,
    });
  });
});
