import { describe, expect, it, vi } from 'vitest';

// @ts-expect-error Vite exposes source files with the raw query as text.
import cloudflareWebAnalyticsSource from './cloudflare-web-analytics.tsx?raw';

import {
  CLOUDFLARE_ANALYTICS_BEACON_SRC,
  CLOUDFLARE_ANALYTICS_TOKEN,
  isCloudflareInsightsUrl,
  decideCloudflareWebAnalyticsRevocation,
  syncCloudflareWebAnalytics,
} from './cloudflare-web-analytics';

type FakeScript = {
  defer: boolean;
  parentNode: FakeHead | null;
  src: string;
  attributes: Map<string, string>;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
};

type FakeHead = {
  scripts: FakeScript[];
  appendChild: (script: FakeScript) => FakeScript;
  removeChild: (script: FakeScript) => FakeScript;
};

function createDocumentHarness() {
  const head: FakeHead = {
    scripts: [],
    appendChild(script) {
      this.scripts.push(script);
      script.parentNode = this;
      return script;
    },
    removeChild(script) {
      this.scripts = this.scripts.filter((candidate) => candidate !== script);
      script.parentNode = null;
      return script;
    },
  };

  const document = {
    head,
    createElement() {
      const attributes = new Map<string, string>();
      return {
        defer: false,
        parentNode: null,
        src: '',
        attributes,
        setAttribute(name: string, value: string) {
          attributes.set(name, value);
        },
        getAttribute(name: string) {
          return attributes.get(name) ?? null;
        },
      } satisfies FakeScript;
    },
    querySelector(selector: string) {
      if (selector !== '[data-zst-cloudflare-analytics="true"]') return null;
      return (
        head.scripts.find(
          (script) =>
            script.getAttribute('data-zst-cloudflare-analytics') === 'true',
        ) ?? null
      );
    },
  };

  return { document: document as unknown as Document, head };
}

describe('Cloudflare Web Analytics consent loader', () => {
  it('pins the analytics token as an unverified site-tag hypothesis', () => {
    expect(cloudflareWebAnalyticsSource).toMatch(
      /\/\/ UNVERIFIED: site-tag hypothesis until consented ingestion is confirmed via the runbook loop\r?\nexport const CLOUDFLARE_ANALYTICS_TOKEN =/,
    );
  });

  it('decides to reload when an injected beacon is revoked', () => {
    expect(
      decideCloudflareWebAnalyticsRevocation({
        beaconInjected: true,
        consentTransition: 'granted-to-denied',
      }),
    ).toBe('reload');
  });

  it('does not reload when a beacon was never injected', () => {
    expect(
      decideCloudflareWebAnalyticsRevocation({
        beaconInjected: false,
        consentTransition: 'granted-to-denied',
      }),
    ).toBe('none');
  });

  it('does not reload for non-revocation consent transitions', () => {
    expect(
      decideCloudflareWebAnalyticsRevocation({
        beaconInjected: true,
        consentTransition: 'initial',
      }),
    ).toBe('none');
    expect(
      decideCloudflareWebAnalyticsRevocation({
        beaconInjected: false,
        consentTransition: 'denied-to-granted',
      }),
    ).toBe('none');
  });

  it('does not inject or reload for an initial denied state', () => {
    const { document, head } = createDocumentHarness();
    const persistDeniedConsent = vi.fn(() => true);
    const reload = vi.fn();

    syncCloudflareWebAnalytics({
      document,
      measurementGranted: false,
      persistDeniedConsent,
      reload,
    });

    expect(head.scripts).toHaveLength(0);
    expect(persistDeniedConsent).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('injects the correctly configured beacon exactly once after measurement consent', () => {
    const { document, head } = createDocumentHarness();

    syncCloudflareWebAnalytics({ document, measurementGranted: true });
    syncCloudflareWebAnalytics({ document, measurementGranted: true });

    expect(head.scripts).toHaveLength(1);
    expect(head.scripts[0]).toMatchObject({
      defer: true,
      src: CLOUDFLARE_ANALYTICS_BEACON_SRC,
    });
    expect(head.scripts[0]?.getAttribute('data-cf-beacon')).toBe(
      JSON.stringify({ token: CLOUDFLARE_ANALYTICS_TOKEN }),
    );
  });

  it('persists denied consent before reloading after revocation', () => {
    const { document } = createDocumentHarness();
    const events: string[] = [];
    const persistDeniedConsent = vi.fn(() => {
      events.push('persist');
      return true;
    });
    const reload = vi.fn(() => events.push('reload'));

    syncCloudflareWebAnalytics({ document, measurementGranted: true });
    syncCloudflareWebAnalytics({
      document,
      measurementGranted: false,
      persistDeniedConsent,
      reload,
    });

    expect(events).toEqual(['persist', 'reload']);
    expect(persistDeniedConsent).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('fails closed when denied consent cannot be confirmed in storage', () => {
    const { document, head } = createDocumentHarness();
    const persistDeniedConsent = vi.fn(() => false);
    const reload = vi.fn();

    syncCloudflareWebAnalytics({ document, measurementGranted: true });
    syncCloudflareWebAnalytics({
      document,
      measurementGranted: false,
      persistDeniedConsent,
      reload,
    });
    syncCloudflareWebAnalytics({ document, measurementGranted: true });

    expect(persistDeniedConsent).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
    expect(head.scripts).toHaveLength(0);
  });

  it('fails closed and retains the revoked guard when persistence throws', () => {
    const { document, head } = createDocumentHarness();
    const reload = vi.fn();

    syncCloudflareWebAnalytics({ document, measurementGranted: true });
    expect(() =>
      syncCloudflareWebAnalytics({
        document,
        measurementGranted: false,
        persistDeniedConsent: () => {
          throw new Error('persistence failed');
        },
        reload,
      }),
    ).not.toThrow();
    syncCloudflareWebAnalytics({ document, measurementGranted: true });

    expect(reload).not.toHaveBeenCalled();
    expect(head.scripts).toHaveLength(0);
  });

  it('does not reload again when denied consent is repeated', () => {
    const { document } = createDocumentHarness();
    const persistDeniedConsent = vi.fn(() => true);
    const reload = vi.fn();

    syncCloudflareWebAnalytics({ document, measurementGranted: true });
    syncCloudflareWebAnalytics({
      document,
      measurementGranted: false,
      persistDeniedConsent,
      reload,
    });
    syncCloudflareWebAnalytics({
      document,
      measurementGranted: false,
      persistDeniedConsent,
      reload,
    });

    expect(persistDeniedConsent).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('persists and reloads once when a recovered owned beacon is revoked', () => {
    const { document, head } = createDocumentHarness();
    const recoveredBeacon = document.createElement(
      'script',
    ) as unknown as FakeScript;
    recoveredBeacon.setAttribute('data-zst-cloudflare-analytics', 'true');
    head.appendChild(recoveredBeacon);
    const events: string[] = [];
    const persistDeniedConsent = vi.fn(() => {
      events.push('persist');
      return true;
    });
    const reload = vi.fn(() => events.push('reload'));

    syncCloudflareWebAnalytics({ document, measurementGranted: true });
    syncCloudflareWebAnalytics({
      document,
      measurementGranted: false,
      persistDeniedConsent,
      reload,
    });
    syncCloudflareWebAnalytics({
      document,
      measurementGranted: false,
      persistDeniedConsent,
      reload,
    });

    expect(events).toEqual(['persist', 'reload']);
    expect(head.scripts).toHaveLength(0);
    expect(persistDeniedConsent).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe('revocation transmission suppression', () => {
  it('classifies insights URLs across shapes', () => {
    expect(isCloudflareInsightsUrl('https://cloudflareinsights.com/cdn-cgi/rum')).toBe(true);
    expect(isCloudflareInsightsUrl('https://static.cloudflareinsights.com/beacon.min.js')).toBe(true);
    expect(isCloudflareInsightsUrl('https://zurielst.com/api/chat')).toBe(false);
    expect(isCloudflareInsightsUrl('/cdn-cgi/rum')).toBe(false);
    expect(isCloudflareInsightsUrl('https://evilcloudflareinsights.com/x')).toBe(false);
    expect(isCloudflareInsightsUrl(undefined)).toBe(false);
  });

  it('blocks insights egress from the revocation instant while passing other traffic', () => {
    const { document, head } = createDocumentHarness();
    const sentBeacons: unknown[] = [];
    const fetched: unknown[] = [];
    const view = {
      navigator: {
        sendBeacon(url: unknown) {
          sentBeacons.push(url);
          return true;
        },
      },
      fetch(input: unknown) {
        fetched.push(input);
        return Promise.resolve({ status: 200 });
      },
      Response: class {
        status: number;
        constructor(_body: unknown, init: { status: number }) {
          this.status = init.status;
        }
      },
    };
    (document as unknown as { defaultView: unknown }).defaultView = view;

    syncCloudflareWebAnalytics({
      document,
      measurementGranted: true,
      persistDeniedConsent: () => true,
      reload: () => {},
    });
    syncCloudflareWebAnalytics({
      document,
      measurementGranted: false,
      persistDeniedConsent: () => true,
      reload: () => {},
    });

    expect(head.scripts).toHaveLength(0);
    view.navigator.sendBeacon('https://cloudflareinsights.com/cdn-cgi/rum');
    view.navigator.sendBeacon('https://example.com/ok');
    void view.fetch('https://cloudflareinsights.com/cdn-cgi/rum');
    void view.fetch('https://zurielst.com/api/chat');

    expect(sentBeacons).toEqual(['https://example.com/ok']);
    expect(fetched).toEqual(['https://zurielst.com/api/chat']);
  });
});
