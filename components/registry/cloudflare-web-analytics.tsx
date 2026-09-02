"use client";

import { useEffect } from 'react';

export const CLOUDFLARE_ANALYTICS_BEACON_SRC =
  'https://static.cloudflareinsights.com/beacon.min.js';
// UNVERIFIED: site-tag hypothesis until consented ingestion is confirmed via the runbook loop
export const CLOUDFLARE_ANALYTICS_TOKEN = '132089a6cdb94c13b46d32c7f2061e18';

const OWNED_BEACON_SELECTOR = '[data-zst-cloudflare-analytics="true"]';

type BeaconState = {
  injected: boolean;
  measurementGranted: boolean | undefined;
  revoked: boolean;
  script: HTMLScriptElement | null;
};

const beaconStates = new WeakMap<Document, BeaconState>();

export type CloudflareWebAnalyticsConsentTransition =
  | 'initial'
  | 'denied-to-granted'
  | 'granted-to-denied'
  | 'unchanged';

export type CloudflareWebAnalyticsRevocationAction = 'none' | 'reload';

export function decideCloudflareWebAnalyticsRevocation({
  beaconInjected,
  consentTransition,
}: {
  beaconInjected: boolean;
  consentTransition: CloudflareWebAnalyticsConsentTransition;
}): CloudflareWebAnalyticsRevocationAction {
  return beaconInjected && consentTransition === 'granted-to-denied'
    ? 'reload'
    : 'none';
}

function getMeasurementConsentTransition({
  previousMeasurementGranted,
  measurementGranted,
}: {
  previousMeasurementGranted: boolean | undefined;
  measurementGranted: boolean;
}): CloudflareWebAnalyticsConsentTransition {
  if (previousMeasurementGranted === undefined) return 'initial';
  if (previousMeasurementGranted === measurementGranted) return 'unchanged';
  return measurementGranted ? 'denied-to-granted' : 'granted-to-denied';
}

function removeOwnedBeaconBestEffort(script: HTMLScriptElement | null) {
  try {
    script?.parentNode?.removeChild(script);
  } catch {
    // The browser can remove the tag before a consent update reaches this effect.
  }
}

export function isCloudflareInsightsUrl(url: unknown): boolean {
  try {
    const candidate =
      typeof Request !== 'undefined' && url instanceof Request ? url.url : String(url);
    const { hostname } = new URL(candidate, 'https://zurielst.com');
    return hostname === 'cloudflareinsights.com' || hostname.endsWith('.cloudflareinsights.com');
  } catch {
    return false;
  }
}

function suppressBeaconTransmissionsBestEffort(document: Document) {
  const view = document.defaultView;
  if (!view) return;
  try {
    const navigatorObject = view.navigator as Navigator & {
      sendBeacon?: Navigator['sendBeacon'];
    };
    const originalSendBeacon = navigatorObject.sendBeacon?.bind(navigatorObject);
    if (originalSendBeacon) {
      navigatorObject.sendBeacon = (url, data) =>
        isCloudflareInsightsUrl(url) ? true : originalSendBeacon(url, data);
    }
    const originalFetch = view.fetch?.bind(view);
    if (originalFetch) {
      view.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
        isCloudflareInsightsUrl(input)
          ? Promise.resolve(new view.Response(null, { status: 204 }))
          : originalFetch(input, init)) as typeof view.fetch;
    }
  } catch {
    // Suppression is best effort; the immediate reload below is the hard stop.
  }
}

export function syncCloudflareWebAnalytics({
  document,
  measurementGranted,
  persistDeniedConsent = () => false,
  reload = () => document.defaultView?.location.reload(),
}: {
  document: Document;
  measurementGranted: boolean;
  persistDeniedConsent?: () => boolean;
  reload?: () => void;
}) {
  const state = beaconStates.get(document) ?? {
    injected: false,
    measurementGranted: undefined,
    revoked: false,
    script: null,
  };
  const consentTransition = getMeasurementConsentTransition({
    previousMeasurementGranted: state.measurementGranted,
    measurementGranted,
  });

  state.measurementGranted = measurementGranted;
  beaconStates.set(document, state);

  if (!measurementGranted) {
    const action = decideCloudflareWebAnalyticsRevocation({
      beaconInjected: state.injected,
      consentTransition,
    });

    if (action === 'reload') {
      state.revoked = true;
      suppressBeaconTransmissionsBestEffort(document);
      removeOwnedBeaconBestEffort(state.script);
      try {
        if (persistDeniedConsent()) reload();
      } catch {
        // Stay revoked on this page rather than reload into stale granted consent.
      }
    }
    return;
  }

  if (state.injected || state.revoked) return;

  const ownedBeacon = document.querySelector<HTMLScriptElement>(
    OWNED_BEACON_SELECTOR,
  );
  if (ownedBeacon) {
    state.injected = true;
    state.script = ownedBeacon;
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
  state.injected = true;
  state.script = script;
}

export function CloudflareWebAnalyticsLoader({
  measurementGranted,
  persistDeniedConsent,
}: {
  measurementGranted: boolean;
  persistDeniedConsent: () => boolean;
}) {
  useEffect(() => {
    syncCloudflareWebAnalytics({
      document,
      measurementGranted,
      persistDeniedConsent,
    });
  }, [measurementGranted, persistDeniedConsent]);

  return null;
}
