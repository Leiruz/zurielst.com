import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const consentManagerMockState = vi.hoisted(() => ({
  consents: {
    experience: false,
    functionality: false,
    marketing: false,
    measurement: false,
    necessary: true,
  },
}));

vi.mock('@c15t/nextjs/headless', () => ({
  ConsentManagerProvider: ({ children }: { children: ReactNode }) => children,
  useConsentManager: () => ({
    consents: consentManagerMockState.consents,
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

function renderConsentManager() {
  return renderToStaticMarkup(createElement(ConsentManager, null, null));
}

describe('ConsentManager analytics wiring', () => {
  beforeEach(() => {
    Object.assign(consentManagerMockState.consents, {
      experience: false,
      functionality: false,
      marketing: false,
      measurement: false,
      necessary: true,
    });
  });

  it('denies analytics when only default necessary consent is granted', () => {
    const markup = renderConsentManager();

    expect(markup).toContain('cloudflare-measurement-denied');
    expect(markup).not.toContain('cloudflare-measurement-granted');
  });

  it('forwards the c15t measurement category to the analytics loader', () => {
    consentManagerMockState.consents.measurement = true;
    const markup = renderConsentManager();

    expect(markup).toContain('cloudflare-measurement-granted');
    expect(markup).not.toContain('cloudflare-measurement-denied');
  });
});
