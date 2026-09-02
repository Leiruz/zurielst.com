import type { ComponentType, ReactNode } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PersistedConsent } from './consent-hydration';

const clientHarness = vi.hoisted(() => ({
  activeRender: false,
  captureEffects: false,
  cleanups: [] as Array<() => void>,
  consentManager: undefined as ComponentType<{
    children: ReactNode;
    mountUi?: boolean;
  }> | undefined,
  cursor: 0,
  state: [] as unknown[],
}));

const consentHarness = vi.hoisted(() => ({
  consentInfo: {
    identified: false,
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
  isPrivacyDialogOpen: false,
  persistedConsent: null as PersistedConsent | null,
  saveConsents: vi.fn(),
  selectedConsents: {
    experience: false,
    functionality: false,
    marketing: false,
    measurement: false,
    necessary: true,
  },
  setIsPrivacyDialogOpen: vi.fn(),
  setSelectedConsent: vi.fn(),
  setShowPopup: vi.fn(),
  showPopup: true,
  storageConfig: { storageKey: 'client-enhancements-consent-test' },
  storageReads: 0,
}));

vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>();

  return {
    ...react,
    useEffect(effect: () => void | (() => void)) {
      if (clientHarness.activeRender && !clientHarness.captureEffects) return;
      const cleanup = effect();
      if (typeof cleanup === 'function') clientHarness.cleanups.push(cleanup);
    },
    useState<T>(initialState: T | (() => T)) {
      if (!clientHarness.activeRender) return react.useState(initialState);

      const index = clientHarness.cursor;
      clientHarness.cursor += 1;
      if (!(index in clientHarness.state)) {
        clientHarness.state[index] =
          typeof initialState === 'function'
            ? (initialState as () => T)()
            : initialState;
      }

      const setState = (nextState: T | ((previous: T) => T)) => {
        const previous = clientHarness.state[index] as T;
        clientHarness.state[index] =
          typeof nextState === 'function'
            ? (nextState as (current: T) => T)(previous)
            : nextState;
      };

      return [clientHarness.state[index] as T, setState] as const;
    },
  };
});

vi.mock('next/dynamic', () => {
  let dynamicImportIndex = 0;

  return {
    default: () => {
      const importIndex = dynamicImportIndex;
      dynamicImportIndex += 1;

      return function DeferredComponent(props: {
        children: ReactNode;
        mountUi?: boolean;
      }) {
        if (importIndex !== 0) return null;
        const ConsentManager = clientHarness.consentManager;
        if (!ConsentManager) throw new Error('Consent manager harness is not ready');
        return createElement(ConsentManager, props);
      };
    },
  };
});

vi.mock('@/components/registry/haptic-feedback', () => ({
  HapticFeedback: () => null,
}));

vi.mock('@c15t/nextjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@c15t/nextjs')>();
  return {
    ...actual,
    getConsentFromStorage: vi.fn(() => {
      consentHarness.storageReads += 1;
      return consentHarness.persistedConsent;
    }),
  };
});

vi.mock('@c15t/nextjs/headless', () => ({
  ConsentManagerProvider: ({ children }: { children: ReactNode }) => children,
  useConsentManager: () => ({
    consentInfo: consentHarness.consentInfo,
    consents: consentHarness.consents,
    isPrivacyDialogOpen: consentHarness.isPrivacyDialogOpen,
    saveConsents: consentHarness.saveConsents,
    setIsPrivacyDialogOpen: consentHarness.setIsPrivacyDialogOpen,
    setSelectedConsent: consentHarness.setSelectedConsent,
    setShowPopup: consentHarness.setShowPopup,
    showPopup: consentHarness.showPopup,
    storageConfig: consentHarness.storageConfig,
  }),
}));

import { ClientEnhancements } from './client-enhancements';
import { ConsentManager } from './consent-manager';

type ConsentProfile = typeof consentHarness.consents;

describe('ClientEnhancements persisted consent runtime', () => {
  beforeEach(() => {
    clientHarness.consentManager = ConsentManager;
    clientHarness.activeRender = false;
    clientHarness.captureEffects = false;
    clientHarness.cursor = 0;
    clientHarness.state = [];

    const denied = createConsentProfile(false);
    Object.assign(consentHarness.consents, denied);
    Object.assign(consentHarness.selectedConsents, denied);
    consentHarness.isPrivacyDialogOpen = false;
    consentHarness.persistedConsent = null;
    consentHarness.showPopup = true;
    consentHarness.storageReads = 0;
    consentHarness.saveConsents.mockReset();
    consentHarness.saveConsents.mockImplementation((choice: string) => {
      if (choice !== 'custom') return;
      Object.assign(consentHarness.consents, consentHarness.selectedConsents);
      consentHarness.showPopup = false;
    });
    consentHarness.setSelectedConsent.mockReset();
    consentHarness.setSelectedConsent.mockImplementation(
      (category: keyof ConsentProfile, value: boolean) => {
        consentHarness.selectedConsents[category] = value;
      },
    );
    consentHarness.setIsPrivacyDialogOpen.mockReset();
    consentHarness.setShowPopup.mockReset();
  });

  afterEach(() => {
    for (const cleanup of clientHarness.cleanups.splice(0)) cleanup();
    vi.unstubAllGlobals();
  });

  it('injects the beacon for stored measurement consent without page engagement', () => {
    const browser = createBrowserHarness();
    consentHarness.persistedConsent = createPersistedConsent(
      createConsentProfile(true),
    );
    installBrowserHarness(browser);

    expect(renderClientEnhancements(true)).toBe('');
    browser.frames.flush();
    renderClientEnhancements(false);

    expect(consentHarness.storageReads).toBe(1);
    expect(consentHarness.saveConsents).toHaveBeenCalledOnce();
    expect(consentHarness.saveConsents).toHaveBeenCalledWith('custom');
    expect(browser.engagementDispatches).toBe(0);
    expect(browser.ownedBeacons()).toHaveLength(1);
  });

  it('hides the banner and injects no beacon for stored denied consent without page engagement', () => {
    const browser = createBrowserHarness();
    consentHarness.persistedConsent = createPersistedConsent(
      createConsentProfile(false),
    );
    installBrowserHarness(browser);

    expect(renderClientEnhancements(true)).toBe('');
    browser.frames.flush();
    const markup = renderClientEnhancements(false);

    expect(consentHarness.storageReads).toBe(1);
    expect(consentHarness.saveConsents).toHaveBeenCalledOnce();
    expect(consentHarness.saveConsents).toHaveBeenCalledWith('custom');
    expect(consentHarness.showPopup).toBe(false);
    expect(markup).not.toContain('data-testid="cookie-banner-root"');
    expect(browser.engagementDispatches).toBe(0);
    expect(browser.ownedBeacons()).toHaveLength(0);
  });
});

function renderClientEnhancements(captureEffects: boolean) {
  clientHarness.activeRender = true;
  clientHarness.captureEffects = captureEffects;
  clientHarness.cursor = 0;
  let tree: ReturnType<typeof ClientEnhancements>;
  try {
    tree = ClientEnhancements();
  } finally {
    clientHarness.activeRender = false;
    clientHarness.captureEffects = false;
  }
  return tree ? renderToStaticMarkup(tree) : '';
}

function createConsentProfile(measurement: boolean): ConsentProfile {
  return {
    experience: false,
    functionality: false,
    marketing: false,
    measurement,
    necessary: true,
  };
}

function createPersistedConsent(consents: ConsentProfile): PersistedConsent {
  return {
    consentInfo: { identified: false, time: 1_756_684_800 },
    consents,
  };
}

function installBrowserHarness(browser: ReturnType<typeof createBrowserHarness>) {
  vi.stubGlobal('cancelAnimationFrame', browser.frames.cancel);
  vi.stubGlobal('document', browser.document);
  vi.stubGlobal('requestAnimationFrame', browser.frames.request);
  vi.stubGlobal('window', browser.window);
}

function createBrowserHarness() {
  let engagementDispatches = 0;
  let nextFrameId = 1;
  const frameCallbacks = new Map<number, FrameRequestCallback>();
  const scripts: Array<{
    attributes: Map<string, string>;
    defer: boolean;
    getAttribute: (name: string) => string | null;
    parentNode: unknown;
    setAttribute: (name: string, value: string) => void;
    src: string;
  }> = [];
  const head = {
    appendChild(node: (typeof scripts)[number]) {
      scripts.push(node);
      node.parentNode = head;
      return node;
    },
    removeChild(node: (typeof scripts)[number]) {
      const index = scripts.indexOf(node);
      if (index >= 0) scripts.splice(index, 1);
      node.parentNode = null;
      return node;
    },
  };
  const document = {
    createElement() {
      const attributes = new Map<string, string>();
      return {
        attributes,
        defer: false,
        getAttribute(name: string) {
          return attributes.get(name) ?? null;
        },
        parentNode: null,
        setAttribute(name: string, value: string) {
          attributes.set(name, value);
        },
        src: '',
      };
    },
    documentElement: { dataset: { intro: 'done' } },
    head,
    querySelector(selector: string) {
      if (selector !== '[data-zst-cloudflare-analytics="true"]') return null;
      return scripts.find(
        (script) =>
          script.getAttribute('data-zst-cloudflare-analytics') === 'true',
      ) ?? null;
    },
  } as unknown as Document;
  const listeners = new Map<string, EventListener>();
  const window = {
    addEventListener(type: string, listener: EventListener) {
      listeners.set(type, listener);
    },
    location: { hostname: 'zurielst.com' },
    removeEventListener(type: string, listener: EventListener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };

  return {
    document,
    frames: {
      cancel(handle: number) {
        frameCallbacks.delete(handle);
      },
      flush() {
        while (frameCallbacks.size > 0) {
          const [handle, callback] = frameCallbacks.entries().next().value as [
            number,
            FrameRequestCallback,
          ];
          frameCallbacks.delete(handle);
          callback(0);
        }
      },
      request(callback: FrameRequestCallback) {
        const handle = nextFrameId;
        nextFrameId += 1;
        frameCallbacks.set(handle, callback);
        return handle;
      },
    },
    get engagementDispatches() {
      return engagementDispatches;
    },
    ownedBeacons() {
      return scripts.filter(
        (script) =>
          script.getAttribute('data-zst-cloudflare-analytics') === 'true',
      );
    },
    window: {
      ...window,
      dispatchEvent() {
        engagementDispatches += 1;
        return true;
      },
    },
  };
}
