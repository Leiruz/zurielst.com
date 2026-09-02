import {
  act,
  createElement,
  StrictMode,
} from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PersistedConsent } from './consent-hydration';

const runtimeHarness = vi.hoisted(() => ({
  snapshots: [] as Array<{
    consentType: string | undefined;
    measurement: boolean;
    showPopup: boolean;
  }>,
  resetConsents: undefined as (() => void) | undefined,
}));

vi.mock('next/dynamic', () => {
  let dynamicImportIndex = 0;

  return {
    default: () => {
      const importIndex = dynamicImportIndex;
      dynamicImportIndex += 1;

      return function DeferredComponent() {
        return createElement(
          importIndex === 0 ? 'intro-gate' : 'theme-switcher',
        );
      };
    },
  };
});

vi.mock('@/components/registry/haptic-feedback', () => ({
  HapticFeedback: () => createElement('haptic-feedback'),
}));

import { useConsentManager } from '@c15t/nextjs/headless';

import { ClientEnhancements } from './client-enhancements';
import { ConsentRuntime } from './consent-runtime';

type ConsentProfile = NonNullable<PersistedConsent['consents']> & {
  experience: boolean;
  functionality: boolean;
  marketing: boolean;
  measurement: boolean;
  necessary: boolean;
};

describe('ClientEnhancements persisted consent runtime', () => {
  let browser: ReturnType<typeof createBrowserHarness>;
  let renderer: ReactTestRenderer | undefined;
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    runtimeHarness.resetConsents = undefined;
    runtimeHarness.snapshots = [];
    browser = createBrowserHarness();
    installBrowserHarness(browser);
    setReactActEnvironment(true);

    const originalConsoleError = console.error;
    consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      if (args[0] === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer') {
        return;
      }
      originalConsoleError(...args);
    });
    const originalConsoleWarn = console.warn;
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      const expectedStorageWarning =
        (args[0] === '[c15t] Failed to migrate legacy storage:' ||
          args[0] === 'Failed to read consent from localStorage:') &&
        args[1] instanceof Error &&
        args[1].message === 'consent storage unavailable';
      if (expectedStorageWarning) return;
      originalConsoleWarn(...args);
    });
  });

  it('reconciles a provider read that changes after a denied preflight', async () => {
    const denied = createPersistedConsent(createConsentProfile(false));
    const granted = createPersistedConsent(createConsentProfile(true));
    browser.seedConsent(granted);
    browser.scriptConsentReads([
      JSON.stringify(denied),
      JSON.stringify(denied),
      JSON.stringify(granted),
      JSON.stringify(granted),
    ]);

    await mountConsentRuntimeWithUi();

    expect(runtimeHarness.snapshots.some(({ measurement }) => measurement)).toBe(false);
    expect(latestConsentSnapshot()).toMatchObject({
      consentType: 'custom',
      measurement: false,
      showPopup: false,
    });
    expect(browser.beaconInsertions).toBe(0);
  });

  afterEach(async () => {
    if (runtimeHarness.resetConsents) {
      await act(async () => runtimeHarness.resetConsents?.());
    }
    if (renderer) {
      await act(async () => renderer?.unmount());
      renderer = undefined;
    }
    consoleError.mockRestore();
    consoleWarn.mockRestore();
    setReactActEnvironment(false);
    vi.unstubAllGlobals();
  });

  it('restores stored measurement consent after intro completion without engagement', async () => {
    browser.seedConsent(createPersistedConsent(
      createConsentProfile(true),
    ));

    await act(async () => {
      renderer = create(createElement(ClientEnhancements));
    });
    await act(async () => {
      browser.completeIntro();
      await nextTask();
    });
    await settleConsentRuntime();

    expect(runtimeHarness.snapshots).toHaveLength(0);
    expect(browser.engagementDispatches).toBe(0);
    expect(browser.ownedBeacons()).toHaveLength(1);
    expect(browser.beaconInsertions).toBe(1);
    expect(findByType(renderer, 'intro-gate')).toHaveLength(0);
    expect(findByType(renderer, 'haptic-feedback')).toHaveLength(0);
    expect(findBanner(renderer)).toHaveLength(0);

    await act(async () => {
      browser.frames.flush();
      browser.engage();
      await nextTask();
    });
    await settleConsentRuntime();

    expect(browser.ownedBeacons()).toHaveLength(1);
    expect(browser.beaconInsertions).toBe(1);
    expect(findBanner(renderer)).toHaveLength(0);
  });

  it('accepts a compressed valid cookie before conflicting localStorage', async () => {
    browser.seedConsent({
      consentInfo: { identified: false, time: 1_756_684_800 },
      consents: { measurement: false, necessary: false },
    });
    browser.seedGrantedConsentCookie();

    await act(async () => {
      renderer = create(createElement(ClientEnhancements));
    });
    await act(async () => {
      browser.completeIntro();
      await nextTask();
    });
    await settleConsentRuntime();

    expect(runtimeHarness.snapshots).toHaveLength(0);
    expect(browser.beaconInsertions).toBe(1);
  });

  it('restores stored denied consent after readiness without engagement or intro completion', async () => {
    browser.seedConsent(createPersistedConsent(
      createConsentProfile(false),
    ));

    await act(async () => {
      renderer = create(createElement(ClientEnhancements));
    });
    await act(async () => {
      browser.frames.flush();
      await nextTask();
    });
    await settleConsentRuntime();

    expect(runtimeHarness.snapshots).toHaveLength(0);
    expect(browser.engagementDispatches).toBe(0);
    expect(browser.ownedBeacons()).toHaveLength(0);
    expect(browser.beaconInsertions).toBe(0);
    expect(findByType(renderer, 'intro-gate')).toHaveLength(1);
    expect(findByType(renderer, 'haptic-feedback')).toHaveLength(1);
    expect(findBanner(renderer)).toHaveLength(0);

    await act(async () => {
      browser.completeIntro();
      browser.engage();
      await nextTask();
    });
    await settleConsentRuntime();

    expect(browser.ownedBeacons()).toHaveLength(0);
    expect(browser.beaconInsertions).toBe(0);
    expect(findBanner(renderer)).toHaveLength(0);
  });

  it('keeps the validated runtime open after a first-time visitor accepts the banner', async () => {
    await mountConsentRuntimeWithUi();

    const acceptButton = renderer?.root.findByProps({
      'data-testid': 'cookie-banner-accept-button',
    });
    expect(acceptButton).toBeDefined();

    await act(async () => {
      acceptButton?.props.onClick();
      await nextTask();
    });
    await flushConsentEffects();

    expect(findBanner(renderer)).toHaveLength(0);
    expect(findByType(renderer, 'consent-state-probe')).toHaveLength(1);
    expect(latestConsentSnapshot()).toMatchObject({
      consentType: 'all',
      measurement: true,
      showPopup: false,
    });
    expect(browser.ownedBeacons()).toHaveLength(1);
    expect(browser.beaconInsertions).toBe(1);
  });

  it('fails closed for incomplete raw consent with granted measurement', async () => {
    browser.seedConsent({
      consentInfo: { identified: false, time: 1_756_684_800 },
      consents: { measurement: true, necessary: true },
    });

    await mountConsentRuntimeWithUi();

    expect.soft(browser.beaconInsertions).toBe(0);
    expect.soft(browser.ownedBeacons()).toHaveLength(0);
    expect.soft(runtimeHarness.snapshots.some(({ measurement }) => measurement)).toBe(false);
    expect.soft(latestConsentSnapshot()).toMatchObject({
      measurement: false,
      showPopup: true,
    });
    expect.soft(browser.storedConsent()).toBeNull();
    expect(findBanner(renderer)).toHaveLength(1);
  });

  it('fails closed for malformed raw consent with granted measurement', async () => {
    browser.seedConsent({
      consentInfo: { identified: false, time: 1_756_684_800 },
      consents: {
        experience: false,
        functionality: false,
        marketing: false,
        measurement: true,
        necessary: false,
      },
    });

    await mountConsentRuntimeWithUi();

    expect.soft(browser.beaconInsertions).toBe(0);
    expect.soft(browser.ownedBeacons()).toHaveLength(0);
    expect.soft(runtimeHarness.snapshots.some(({ measurement }) => measurement)).toBe(false);
    expect.soft(latestConsentSnapshot()).toMatchObject({
      measurement: false,
      showPopup: true,
    });
    expect.soft(browser.storedConsent()).toBeNull();
    expect(findBanner(renderer)).toHaveLength(1);
  });

  it('fails closed when raw localStorage access throws before a granted cookie', async () => {
    browser.seedGrantedConsentCookie();
    browser.failConsentReads();

    await mountConsentRuntimeWithUi();

    expect.soft(browser.beaconInsertions).toBe(0);
    expect.soft(browser.ownedBeacons()).toHaveLength(0);
    expect.soft(runtimeHarness.snapshots.some(({ measurement }) => measurement)).toBe(false);
    expect.soft(latestConsentSnapshot()).toMatchObject({
      measurement: false,
      showPopup: true,
    });
    expect(findBanner(renderer)).toHaveLength(1);
  });

  it('retains one invalid preflight result across StrictMode effect replay', async () => {
    browser.seedConsent({
      consentInfo: { identified: false, time: 1_756_684_800 },
      consents: { measurement: true, necessary: true },
    });

    await mountConsentRuntimeWithUi(true);

    expect(browser.consentDeletions).toBe(2);
    expect(runtimeHarness.snapshots.some(({ measurement }) => measurement)).toBe(false);
    expect(browser.beaconInsertions).toBe(0);
    expect(findBanner(renderer)).toHaveLength(1);
  });

  it.each([
    ['absent', null],
    [
      'malformed',
      {
        consentInfo: { identified: false, time: 1_756_684_800 },
        consents: { measurement: true, necessary: true },
      },
    ],
  ])(
    'reconciles a granted provider cache against %s storage under StrictMode',
    async (_label, nextConsent) => {
      await primeGrantedProviderCache();
      browser = createBrowserHarness();
      installBrowserHarness(browser);
      if (nextConsent) browser.seedConsent(nextConsent);
      runtimeHarness.snapshots = [];

      await mountConsentRuntimeWithUi(true);

      expect(runtimeHarness.snapshots.some(({ measurement }) => measurement)).toBe(false);
      expect(latestConsentSnapshot()).toMatchObject({
        measurement: false,
        showPopup: true,
      });
      expect(browser.beaconInsertions).toBe(0);
      expect(findBanner(renderer)).toHaveLength(1);
    },
  );

  async function primeGrantedProviderCache() {
    browser.seedConsent(createPersistedConsent(createConsentProfile(true)));
    await mountConsentRuntimeWithUi();
    expect(latestConsentSnapshot()?.measurement).toBe(true);

    await act(async () => renderer?.unmount());
    renderer = undefined;
  }

  async function mountConsentRuntimeWithUi(strictMode = false) {
    await act(async () => {
      const runtime = createElement(
        ConsentRuntime,
        { mountUi: true },
        createElement(ConsentStateProbe),
      );
      renderer = create(
        strictMode
          ? createElement(StrictMode, null, runtime)
          : runtime,
      );
    });
    await settleConsentRuntime();
  }

  async function settleConsentRuntime() {
    await act(async () => {
      await vi.dynamicImportSettled();
    });
    await flushConsentEffects();
    await act(async () => {
      await vi.dynamicImportSettled();
    });
    await flushConsentEffects();
  }

  async function flushConsentEffects() {
    await act(async () => {
      await nextTask();
      await nextTask();
    });
  }
});

function ConsentStateProbe() {
  const { consentInfo, consents, resetConsents, showPopup } = useConsentManager();
  runtimeHarness.resetConsents = resetConsents;
  runtimeHarness.snapshots.push({
    consentType: consentInfo?.type,
    measurement: consents.measurement,
    showPopup,
  });
  return createElement('consent-state-probe');
}

function latestConsentSnapshot() {
  return runtimeHarness.snapshots.at(-1);
}

function findByType(
  renderer: ReactTestRenderer | undefined,
  type: string,
): ReactTestInstance[] {
  return renderer?.root.findAll((node) => node.type === type) ?? [];
}

function findBanner(renderer: ReactTestRenderer | undefined) {
  return renderer?.root.findAll(
    (node) => node.props['data-testid'] === 'cookie-banner-root',
  ) ?? [];
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

function nextTask() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function setReactActEnvironment(enabled: boolean) {
  (globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }).IS_REACT_ACT_ENVIRONMENT = enabled;
}

function installBrowserHarness(browser: ReturnType<typeof createBrowserHarness>) {
  vi.stubGlobal('cancelAnimationFrame', browser.frames.cancel);
  vi.stubGlobal('document', browser.document);
  vi.stubGlobal('MutationObserver', browser.MutationObserver);
  vi.stubGlobal('requestAnimationFrame', browser.frames.request);
  vi.stubGlobal('window', browser.window);
}

function createBrowserHarness() {
  let beaconInsertions = 0;
  let cookie = '';
  let consentDeletions = 0;
  let engagementDispatches = 0;
  let introObserverCallback = () => {};
  let nextFrameId = 1;
  let throwOnConsentRead = false;
  const scriptedConsentReads: string[] = [];
  const frameCallbacks = new Map<number, FrameRequestCallback>();
  const listeners = new Map<string, EventListener>();
  const localStorageValues = new Map<string, string>();
  const scripts: FakeScript[] = [];
  const head = {
    appendChild(node: FakeScript) {
      scripts.push(node);
      if (node.getAttribute('data-zst-cloudflare-analytics') === 'true') {
        beaconInsertions += 1;
      }
      node.parentNode = head;
      return node;
    },
    removeChild(node: FakeScript) {
      const index = scripts.indexOf(node);
      if (index >= 0) scripts.splice(index, 1);
      node.parentNode = null;
      return node;
    },
  };
  const documentClasses = new Set<string>();
  const documentRoot = {
    classList: {
      add(name: string) {
        documentClasses.add(name);
      },
      contains(name: string) {
        return documentClasses.has(name);
      },
      remove(name: string) {
        documentClasses.delete(name);
      },
      toggle(name: string, enabled: boolean) {
        if (enabled) documentClasses.add(name);
        else documentClasses.delete(name);
      },
    },
    dataset: { intro: 'active' },
  };
  const localStorage = {
    clear() {
      localStorageValues.clear();
    },
    getItem(key: string) {
      if (throwOnConsentRead && key === 'c15t') {
        throw new Error('consent storage unavailable');
      }
      if (key === 'c15t' && scriptedConsentReads.length > 0) {
        return scriptedConsentReads.shift() ?? null;
      }
      return localStorageValues.get(key) ?? null;
    },
    removeItem(key: string) {
      if (key === 'c15t') consentDeletions += 1;
      localStorageValues.delete(key);
    },
    setItem(key: string, value: string) {
      localStorageValues.set(key, value);
    },
  };
  const window = {
    addEventListener(type: string, listener: EventListener) {
      listeners.set(type, listener);
    },
    dispatchEvent() {
      engagementDispatches += 1;
      return true;
    },
    fetch: vi.fn(async () => new Response(null, { status: 204 })),
    localStorage,
    location: { hostname: 'zurielst.com', reload: vi.fn() },
    matchMedia: () => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    }),
    navigator: { doNotTrack: '0' },
    removeEventListener(type: string, listener: EventListener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    XMLHttpRequest: class {
      open() {}
    },
  };
  const document = {
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      cookie = value;
    },
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
      } satisfies FakeScript;
    },
    defaultView: window,
    documentElement: documentRoot,
    head,
    querySelector(selector: string) {
      if (selector !== '[data-zst-cloudflare-analytics="true"]') return null;
      return scripts.find(
        (script) =>
          script.getAttribute('data-zst-cloudflare-analytics') === 'true',
      ) ?? null;
    },
    querySelectorAll() {
      return [];
    },
    readyState: 'complete',
  } as unknown as Document;

  return {
    get beaconInsertions() {
      return beaconInsertions;
    },
    get consentDeletions() {
      return consentDeletions;
    },
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
    engage() {
      listeners.get('pointerdown')?.(new Event('pointerdown'));
    },
    failConsentReads() {
      throwOnConsentRead = true;
    },
    completeIntro() {
      documentRoot.dataset.intro = 'done';
      introObserverCallback();
    },
    MutationObserver: class {
      constructor(callback: () => void) {
        introObserverCallback = callback;
      }

      disconnect() {}

      observe() {}
    },
    ownedBeacons() {
      return scripts.filter(
        (script) =>
          script.getAttribute('data-zst-cloudflare-analytics') === 'true',
      );
    },
    seedConsent(value: unknown) {
      localStorage.setItem('c15t', JSON.stringify(value));
    },
    seedGrantedConsentCookie() {
      cookie = 'c15t=c.necessary:1,c.measurement:1,i.t:1756684800,i.y:custom';
    },
    scriptConsentReads(values: string[]) {
      scriptedConsentReads.push(...values);
    },
    storedConsent() {
      const stored = localStorage.getItem('c15t');
      return stored === null ? null : JSON.parse(stored) as unknown;
    },
    window,
  };
}

type FakeScript = {
  attributes: Map<string, string>;
  defer: boolean;
  getAttribute: (name: string) => string | null;
  parentNode: unknown;
  setAttribute: (name: string, value: string) => void;
  src: string;
};
