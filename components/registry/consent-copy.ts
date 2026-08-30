const description =
  'This site can count visits with one consent-gated measurement signal. No ads, no personalization, no third-party tracking. Decline and everything still works.';

export const CONSENT_TRANSLATIONS = {
  defaultLanguage: 'en',
  disableAutoLanguageSwitch: true,
  translations: {
    en: {
      cookieBanner: { title: 'Privacy choice', description },
      consentManagerDialog: { title: 'Privacy choice', description },
    },
  },
} as const;
