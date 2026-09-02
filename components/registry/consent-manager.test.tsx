import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FooterPrivacyChoices } from '@/components/footer-privacy-choices';

const effectHarness = vi.hoisted(() => ({
  cleanups: [] as Array<() => void>,
  run: false,
}));

const consentStorageMock = vi.hoisted(() => ({
  readError: undefined as Error | undefined,
}));

vi.mock('@c15t/nextjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@c15t/nextjs')>();
  return {
    ...actual,
    getConsentFromStorage: vi.fn(() => {
      if (consentStorageMock.readError) throw consentStorageMock.readError;
      return null;
    }),
  };
});

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
  analyticsPersistence: undefined as undefined | (() => boolean),
  consentInfo: {
    time: 1_756_684_800,
    type: 'custom' as const,
  },
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
  saveConsents: vi.fn((choice: 'all' | 'custom' | 'necessary') => {
    consentManagerMockState.consents.measurement = choice === 'all';
  }),
  setSelectedConsent: vi.fn(),
  setIsPrivacyDialogOpen: vi.fn((isOpen: boolean) => {
    consentManagerMockState.isPrivacyDialogOpen = isOpen;
  }),
  setShowPopup: vi.fn(),
  showPopup: false,
  storageConfig: {
    storageKey: 'test-consent',
  },
}));

vi.mock('@c15t/nextjs/headless', () => ({
  ConsentManagerProvider: ({ children }: { children: ReactNode }) => children,
  useConsentManager: () => ({
    consentInfo: consentManagerMockState.consentInfo,
    consents: consentManagerMockState.consents,
    isPrivacyDialogOpen: consentManagerMockState.isPrivacyDialogOpen,
    saveConsents: consentManagerMockState.saveConsents,
    setSelectedConsent: consentManagerMockState.setSelectedConsent,
    setIsPrivacyDialogOpen: consentManagerMockState.setIsPrivacyDialogOpen,
    setShowPopup: consentManagerMockState.setShowPopup,
    showPopup: consentManagerMockState.showPopup,
    storageConfig: consentManagerMockState.storageConfig,
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
    persistDeniedConsent,
  }: {
    measurementGranted: boolean;
    persistDeniedConsent?: () => boolean;
  }) => {
    consentManagerMockState.analyticsPersistence = persistDeniedConsent;
    return measurementGranted
      ? 'cloudflare-measurement-granted'
      : 'cloudflare-measurement-denied';
  },
}));

vi.mock('@/components/registry/consent-manager-dialog', () => ({
  ConsentManagerDialog: () => null,
}));

import {
  ConsentManager,
  persistDeniedMeasurementConsent,
} from './consent-manager';
import { ConsentManagerUi } from './consent-manager-ui';

type ConsentState = Parameters<
  typeof persistDeniedMeasurementConsent
>[0]['consents'];

function createDeniedConsents(): ConsentState {
  return {
    experience: false,
    functionality: false,
    marketing: false,
    measurement: false,
    necessary: true,
  };
}

function renderConsentManager() {
  return renderToStaticMarkup(createElement(ConsentManager, null, null));
}

function renderConsentManagerUi() {
  return renderToStaticMarkup(createElement(ConsentManagerUi));
}

describe('ConsentManager analytics wiring', () => {
  afterEach(() => {
    for (const cleanup of effectHarness.cleanups.splice(0)) cleanup();
    effectHarness.run = false;
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    consentStorageMock.readError = undefined;
    consentManagerMockState.analyticsPersistence = undefined;
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
    consentManagerMockState.setSelectedConsent.mockClear();
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
    expect(consentManagerMockState.analyticsPersistence).toBeTypeOf('function');
  });

  it('fails closed when persisted consent storage throws on mount', () => {
    consentStorageMock.readError = new Error('storage unavailable');
    vi.stubGlobal('window', createPrivacyChoicesTarget());
    effectHarness.run = true;

    expect(() => renderConsentManager()).not.toThrow();
    expect(consentManagerMockState.saveConsents).not.toHaveBeenCalled();
  });

  it('bridges the footer opener and separately covers banner accept and reject transitions', () => {
    const target = createPrivacyChoicesTarget();
    vi.stubGlobal('window', target);
    effectHarness.run = true;
    consentManagerMockState.showPopup = true;
    renderConsentManagerUi();
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
    renderConsentManagerUi();
    rejectCapturedBannerForFastEventBridgeCoverage();
    expect(consentManagerMockState.saveConsents).toHaveBeenLastCalledWith('necessary');
    expect(renderConsentManager()).toContain('cloudflare-measurement-denied');
  });

  it('saves current denied consents and confirms canonical denied readback', () => {
    const consents = createDeniedConsents();
    const consentInfo = consentManagerMockState.consentInfo;
    const storageConfig = consentManagerMockState.storageConfig;
    const events: string[] = [];
    const saveConsent = vi.fn(
      (
        _data: unknown,
        _cookieOptions?: unknown,
        _config?: unknown,
      ) => events.push('save'),
    );
    const readConsent = vi.fn((_config?: unknown) => {
      events.push('read');
      return { consents: { measurement: false } };
    });

    expect(
      persistDeniedMeasurementConsent({
        consentInfo,
        consents,
        readConsent,
        saveConsent,
        storageConfig,
      }),
    ).toBe(true);
    expect(events).toEqual(['save', 'read']);
    expect(saveConsent).toHaveBeenCalledWith(
      { consentInfo, consents },
      undefined,
      storageConfig,
    );
    expect(readConsent).toHaveBeenCalledWith(storageConfig);
  });

  it('rejects persistence while current measurement consent is granted', () => {
    const saveConsent = vi.fn();
    const readConsent = vi.fn();

    expect(
      persistDeniedMeasurementConsent({
        consentInfo: consentManagerMockState.consentInfo,
        consents: { ...createDeniedConsents(), measurement: true },
        readConsent,
        saveConsent,
        storageConfig: consentManagerMockState.storageConfig,
      }),
    ).toBe(false);
    expect(saveConsent).not.toHaveBeenCalled();
    expect(readConsent).not.toHaveBeenCalled();
  });

  it('rejects persistence when c15t has no consent metadata', () => {
    const saveConsent = vi.fn();
    const readConsent = vi.fn();

    expect(
      persistDeniedMeasurementConsent({
        consentInfo: null,
        consents: createDeniedConsents(),
        readConsent,
        saveConsent,
        storageConfig: consentManagerMockState.storageConfig,
      }),
    ).toBe(false);
    expect(saveConsent).not.toHaveBeenCalled();
    expect(readConsent).not.toHaveBeenCalled();
  });

  it('fails closed when c15t storage throws during the denied save', () => {
    const readConsent = vi.fn();

    expect(
      persistDeniedMeasurementConsent({
        consentInfo: consentManagerMockState.consentInfo,
        consents: createDeniedConsents(),
        readConsent,
        saveConsent: () => {
          throw new Error('storage unavailable');
        },
        storageConfig: consentManagerMockState.storageConfig,
      }),
    ).toBe(false);
    expect(readConsent).not.toHaveBeenCalled();
  });

  it('fails closed when canonical readback remains granted', () => {
    const saveConsent = vi.fn();

    expect(
      persistDeniedMeasurementConsent({
        consentInfo: consentManagerMockState.consentInfo,
        consents: createDeniedConsents(),
        readConsent: () => ({ consents: { measurement: true } }),
        saveConsent,
        storageConfig: consentManagerMockState.storageConfig,
      }),
    ).toBe(false);
    expect(saveConsent).toHaveBeenCalledOnce();
  });
});

function rejectCapturedBannerForFastEventBridgeCoverage() {
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
