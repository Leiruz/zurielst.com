"use client";

import { useEffect } from 'react';

export const CLOUDFLARE_ANALYTICS_BEACON_SRC =
  'https://static.cloudflareinsights.com/beacon.min.js';
export const CLOUDFLARE_ANALYTICS_TOKEN = '132089a6cdb94c13b46d32c7f2061e18';

const OWNED_BEACON_SELECTOR = '[data-zst-cloudflare-analytics="true"]';

type BeaconState = {
  injected: boolean;
  revoked: boolean;
  script: HTMLScriptElement | null;
};

const beaconStates = new WeakMap<Document, BeaconState>();

function removeOwnedBeacon(script: HTMLScriptElement | null) {
  try {
    script?.parentNode?.removeChild(script);
  } catch {
    // The browser can remove the tag before a consent update reaches this effect.
  }
}

export function syncCloudflareWebAnalytics({
  document,
  measurementGranted,
}: {
  document: Document;
  measurementGranted: boolean;
}) {
  const state = beaconStates.get(document);

  if (!measurementGranted) {
    if (state?.injected) {
      state.revoked = true;
      removeOwnedBeacon(state.script);
    }
    return;
  }

  if (state?.injected || state?.revoked) return;

  const ownedBeacon = document.querySelector<HTMLScriptElement>(
    OWNED_BEACON_SELECTOR,
  );
  if (ownedBeacon) {
    beaconStates.set(document, {
      injected: true,
      revoked: false,
      script: ownedBeacon,
    });
    return;
  }

  const script = document.createElement('script');
  script.defer = true;
  script.src = CLOUDFLARE_ANALYTICS_BEACON_SRC;
  script.setAttribute(
    'data-cf-beacon',
    JSON.stringify({ token: CLOUDFLARE_ANALYTICS_TOKEN }),
  );
  script.setAttribute('data-zst-cloudflare-analytics', 'true');
  document.head.appendChild(script);
  beaconStates.set(document, { injected: true, revoked: false, script });
}

export function CloudflareWebAnalyticsLoader({
  measurementGranted,
}: {
  measurementGranted: boolean;
}) {
  useEffect(() => {
    syncCloudflareWebAnalytics({ document, measurementGranted });
  }, [measurementGranted]);

  return null;
}
