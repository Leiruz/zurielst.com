import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FooterPrivacyChoices } from '@/components/footer-privacy-choices';

const effectHarness = vi.hoisted(() => ({
  cleanups: [] as Array<() => void>,
  run: false,
}));

vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>();
  return {
    ...react,
    useEffect(effect: () => void | (() => void)) {
      if (!effectHarness.run) return;
      const cleanup = effect();
      if (typeof cleanup === 'function') effectHarness.cleanups.push(cleanup);
    },
  };
});

const consentManagerMockState = vi.hoisted(() => ({
  consents: {
    experience: false,
    functionality: false,
    marketing: false,
    measurement: false,
    necessary: true,
  },
  banner: undefined as undefined | {
    onAccept: () => void;
    onCustomize: () => void;
    onReject: () => void;
  },
  isPrivacyDialogOpen: false,
  saveConsents: vi.fn((choice: 'all' | 'necessary') => {
    consentManagerMockState.consents.measurement = choice === 'all';
  }),
  setIsPrivacyDialogOpen: vi.fn((isOpen: boolean) => {
    consentManagerMockState.isPrivacyDialogOpen = isOpen;
  }),
  setShowPopup: vi.fn(),
  showPopup: false,
}));

vi.mock('@c15t/nextjs/headless', () => ({
  ConsentManagerProvider: ({ children }: { children: ReactNode }) => children,
  useConsentManager: () => ({
    consents: consentManagerMockState.consents,
    isPrivacyDialogOpen: consentManagerMockState.isPrivacyDialogOpen,
    saveConsents: consentManagerMockState.saveConsents,
    setIsPrivacyDialogOpen: consentManagerMockState.setIsPrivacyDialogOpen,
    setShowPopup: consentManagerMockState.setShowPopup,
    showPopup: consentManagerMockState.showPopup,
  }),
}));

vi.mock('@/components/registry/consent-banner', () => ({
  ConsentBanner: (props: {
    onAccept: () => void;
    onCustomize: () => void;
    onReject: () => void;
  }) => {
    consentManagerMockState.banner = props;
    return null;
  },
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
  afterEach(() => {
    for (const cleanup of effectHarness.cleanups.splice(0)) cleanup();
    effectHarness.run = false;
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    Object.assign(consentManagerMockState.consents, {
      experience: false,
      functionality: false,
      marketing: false,
      measurement: false,
      necessary: true,
    });
    consentManagerMockState.banner = undefined;
    consentManagerMockState.isPrivacyDialogOpen = false;
    consentManagerMockState.saveConsents.mockClear();
    consentManagerMockState.setIsPrivacyDialogOpen.mockClear();
    consentManagerMockState.setShowPopup.mockClear();
    consentManagerMockState.showPopup = false;
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

  it('accepts consent, reopens preferences from the footer path, and saves necessary-only consent', () => {
    const target = createPrivacyChoicesTarget();
    vi.stubGlobal('window', target);
    effectHarness.run = true;
    consentManagerMockState.showPopup = true;
    renderConsentManager();
    consentManagerMockState.banner?.onAccept();

    expect(renderConsentManager()).toContain('cloudflare-measurement-granted');

    const opener = { id: 'privacy-choices' };
    const footerButton = FooterPrivacyChoices() as ReactElement<{
      onClick: (event: { currentTarget: unknown }) => void;
    }>;
    footerButton.props.onClick({ currentTarget: opener });

    expect(consentManagerMockState.setIsPrivacyDialogOpen).toHaveBeenCalledWith(true);
    expect(consentManagerMockState.isPrivacyDialogOpen).toBe(true);

    consentManagerMockState.banner = undefined;
    consentManagerMockState.showPopup = true;
    renderConsentManager();
    rejectCapturedBanner();
    expect(consentManagerMockState.saveConsents).toHaveBeenLastCalledWith('necessary');
    expect(renderConsentManager()).toContain('cloudflare-measurement-denied');
  });
});

function rejectCapturedBanner() {
  consentManagerMockState.banner?.onReject();
}

function createPrivacyChoicesTarget() {
  const listeners = new Map<string, (event: { detail?: unknown; type: string }) => void>();
  return {
    CustomEvent: class {
      detail?: unknown;
      type: string;

      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    addEventListener(type: string, listener: (event: { detail?: unknown; type: string }) => void) {
      listeners.set(type, listener);
    },
    dispatchEvent(event: { detail?: unknown; type: string }) {
      listeners.get(event.type)?.(event);
    },
    removeEventListener(type: string, listener: (event: { detail?: unknown; type: string }) => void) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
}
