import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@c15t/nextjs/headless', () => ({
  ConsentManagerProvider: ({ children }: { children: ReactNode }) => children,
  useConsentManager: () => ({
    consents: {
      experience: false,
      functionality: false,
      marketing: false,
      measurement: true,
      necessary: true,
    },
    isPrivacyDialogOpen: false,
    saveConsents: vi.fn(),
    setIsPrivacyDialogOpen: vi.fn(),
    setShowPopup: vi.fn(),
    showPopup: false,
  }),
}));

vi.mock('@/components/registry/cloudflare-web-analytics', () => ({
  CloudflareWebAnalyticsLoader: ({
    measurementGranted,
  }: {
    measurementGranted: boolean;
  }) =>
    measurementGranted
      ? 'cloudflare-measurement-granted'
      : 'cloudflare-measurement-denied',
}));

import { ConsentManager } from './consent-manager';

describe('ConsentManager analytics wiring', () => {
  it('forwards the c15t measurement category to the analytics loader', () => {
    const markup = renderToStaticMarkup(
      createElement(ConsentManager, null, null),
    );

    expect(markup).toContain('cloudflare-measurement-granted');
    expect(markup).not.toContain('cloudflare-measurement-denied');
  });
});
