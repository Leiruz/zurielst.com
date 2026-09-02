import {
  act,
  createElement,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PersistedConsent } from './consent-hydration';
import { clearConsentManagerCache } from '../../node_modules/@c15t/react/dist/providers/consent-manager-provider.js';

const runtimeHarness = vi.hoisted(() => ({
  consentManager: undefined as ComponentType<{
    children: ReactNode;
    mountUi?: boolean;
  }> | undefined,
  persistedConsent: null as PersistedConsent | null,
  snapshots: [] as Array<{
    consentType: string | undefined;
    measurement: boolean;
    showPopup: boolean;
  }>,
  storageReads: 0,
}));

vi.mock('next/dynamic', () => {
  let dynamicImportIndex = 0;

  return {
    default: () => {
      const importIndex = dynamicImportIndex;
      dynamicImportIndex += 1;

      return function DeferredComponent(props: {
        children?: ReactNode;
        mountUi?: boolean;
      }) {
        if (importIndex === 0) {
          const ConsentManager = runtimeHarness.consentManager;
          if (!ConsentManager) {
            throw new Error('Consent manager harness is not ready');
          }
          return createElement(ConsentManager, {
            ...props,
            children: createElement(ConsentStateProbe),
          });
        }
        if (importIndex === 1) return createElement('intro-gate');
        return createElement('theme-switcher');
      };
    },
  };
});

vi.mock('@/components/registry/haptic-feedback', () => ({
  HapticFeedback: () => createElement('haptic-feedback'),
}));

vi.mock('@c15t/nextjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@c15t/nextjs')>();
  return {
    ...actual,
    getConsentFromStorage: vi.fn(() => {
      runtimeHarness.storageReads += 1;
      return runtimeHarness.persistedConsent;
    }),
  };
});

import { useConsentManager } from '@c15t/nextjs/headless';

import { ClientEnhancements } from './client-enhancements';
import { ConsentManager } from './consent-manager';

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

  beforeEach(() => {
    clearConsentManagerCache();
    runtimeHarness.consentManager = ConsentManager;
    runtimeHarness.persistedConsent = null;
    runtimeHarness.snapshots = [];
    runtimeHarness.storageReads = 0;
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
  });

  afterEach(async () => {
    if (renderer) {
      await act(async () => renderer?.unmount());
      renderer = undefined;
    }
    clearConsentManagerCache();
    consoleError.mockRestore();
    setReactActEnvironment(false);
    vi.unstubAllGlobals();
  });

  it('restores stored measurement consent after intro completion without engagement', async () => {
    runtimeHarness.persistedConsent = createPersistedConsent(
      createConsentProfile(true),
    );

    await act(async () => {
      renderer = create(createElement(ClientEnhancements));
    });
    await act(async () => {
      browser.completeIntro();
      await nextTask();
    });
    await flushConsentEffects();

    expect(runtimeHarness.storageReads).toBe(1);
    expect(latestConsentSnapshot()).toMatchObject({
      consentType: 'custom',
      measurement: true,
      showPopup: false,
    });
    expect(browser.engagementDispatches).toBe(0);
    expect(browser.ownedBeacons()).toHaveLength(1);
    expect(browser.beaconInsertions).toBe(1);
    expect(findByType(renderer, 'intro-gate')).toHaveLength(0);
    expect(findByType(renderer, 'haptic-feedback')).toHaveLength(0);
    expect(findBanner(renderer)).toHaveLength(0);
  });

  it('restores stored denied consent after readiness without engagement or intro completion', async () => {
    runtimeHarness.persistedConsent = createPersistedConsent(
      createConsentProfile(false),
    );

    await act(async () => {
      renderer = create(createElement(ClientEnhancements));
    });
    await act(async () => {
      browser.frames.flush();
      await nextTask();
    });
    await flushConsentEffects();

    expect(runtimeHarness.storageReads).toBe(1);
    expect(latestConsentSnapshot()).toMatchObject({
      consentType: 'custom',
      measurement: false,
      showPopup: false,
    });
    expect(browser.engagementDispatches).toBe(0);
    expect(browser.ownedBeacons()).toHaveLength(0);
    expect(browser.beaconInsertions).toBe(0);
    expect(findByType(renderer, 'intro-gate')).toHaveLength(1);
    expect(findByType(renderer, 'haptic-feedback')).toHaveLength(1);
    expect(findBanner(renderer)).toHaveLength(0);
  });

  async function flushConsentEffects() {
    await act(async () => {
      await nextTask();
      await nextTask();
    });
  }
});

function ConsentStateProbe() {
  const { consentInfo, consents, showPopup } = useConsentManager();
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
  let engagementDispatches = 0;
  let introObserverCallback = () => {};
  let nextFrameId = 1;
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
      return localStorageValues.get(key) ?? null;
    },
    removeItem(key: string) {
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
