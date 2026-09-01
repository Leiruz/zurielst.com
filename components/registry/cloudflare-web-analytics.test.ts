import { describe, expect, it } from 'vitest';

import {
  CLOUDFLARE_ANALYTICS_BEACON_SRC,
  CLOUDFLARE_ANALYTICS_TOKEN,
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

  it('does not inject a beacon before measurement consent', () => {
    const { document, head } = createDocumentHarness();

    syncCloudflareWebAnalytics({ document, measurementGranted: false });

    expect(head.scripts).toHaveLength(0);
  });

  it('removes the owned beacon after revocation and never re-adds it', () => {
    const { document, head } = createDocumentHarness();

    syncCloudflareWebAnalytics({ document, measurementGranted: true });
    syncCloudflareWebAnalytics({ document, measurementGranted: false });
    syncCloudflareWebAnalytics({ document, measurementGranted: true });

    expect(head.scripts).toHaveLength(0);
  });
});
