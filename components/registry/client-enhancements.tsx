'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { HapticFeedback } from '@/components/registry/haptic-feedback';

const PAGE_ENGAGEMENT_EVENTS = [
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
] as const;

type PageEngagementTarget = {
  addEventListener: (
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListener,
    options?: EventListenerOptions,
  ) => void;
};

type IntroStateRoot = {
  dataset: { intro?: string };
};

type IntroCompletionObserver = {
  disconnect: () => void;
  observe: (target: IntroStateRoot, options: MutationObserverInit) => void;
};

type IntroCompletionObserverFactory = (
  notify: () => void,
) => IntroCompletionObserver;

const DeferredConsentManager = dynamic(
  () =>
    import('@/components/registry/consent-manager').then(
      (module) => module.ConsentManager,
    ),
  { ssr: false },
);

const DeferredIntroGate = dynamic(
  () =>
    import('@/components/registry/intro-gate').then(
      (module) => module.IntroGate,
    ),
  { ssr: false },
);

export const DeferredThemeSwitcher = dynamic(
  () =>
    import('@/components/registry/theme-switcher').then(
      (module) => module.ThemeSwitcher,
    ),
  {
    loading: () => <div className="flex h-11 w-11" />,
    ssr: false,
  },
);

export function scheduleAfterPaint(
  callback: () => void,
  requestFrame: (callback: FrameRequestCallback) => number = requestAnimationFrame,
  cancelFrame: (handle: number) => void = cancelAnimationFrame,
) {
  let active = true;
  let frameHandle: number | null = requestFrame(() => {
    frameHandle = requestFrame(() => {
      frameHandle = null;
      if (active) callback();
    });
  });

  return () => {
    active = false;
    if (frameHandle !== null) cancelFrame(frameHandle);
  };
}

export function shouldMountConsent({
  engaged,
  introComplete,
  ready,
}: {
  engaged: boolean;
  introComplete: boolean;
  ready: boolean;
}) {
  return engaged && introComplete && ready;
}

export function listenForPageEngagement(
  onEngage: () => void,
  target: PageEngagementTarget = window,
) {
  let listening = true;
  const cleanup = () => {
    if (!listening) return;
    listening = false;
    for (const eventName of PAGE_ENGAGEMENT_EVENTS) {
      target.removeEventListener(eventName, handleEngagement);
    }
  };
  const handleEngagement = () => {
    cleanup();
    onEngage();
  };

  for (const eventName of PAGE_ENGAGEMENT_EVENTS) {
    target.addEventListener(eventName, handleEngagement, { passive: true });
  }

  return cleanup;
}

function createIntroCompletionObserver(
  notify: () => void,
): IntroCompletionObserver {
  const observer = new MutationObserver(() => notify());
  return {
    disconnect: () => observer.disconnect(),
    observe: (target, options) =>
      observer.observe(target as HTMLElement, options),
  };
}

export function watchIntroCompletion(
  onComplete: () => void,
  root: IntroStateRoot = document.documentElement,
  createObserver: IntroCompletionObserverFactory =
    createIntroCompletionObserver,
) {
  if (root.dataset.intro === 'done') {
    onComplete();
    return () => {};
  }

  let complete = false;
  let observer: IntroCompletionObserver;
  const finishWhenComplete = () => {
    if (complete || root.dataset.intro !== 'done') return;
    complete = true;
    observer.disconnect();
    onComplete();
  };

  observer = createObserver(finishWhenComplete);
  observer.observe(root, {
    attributeFilter: ['data-intro'],
    attributes: true,
  });
  finishWhenComplete();

  return () => {
    complete = true;
    observer.disconnect();
  };
}

export function ClientEnhancements() {
  const [ready, setReady] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);

  useEffect(() => scheduleAfterPaint(() => setReady(true)), []);
  useEffect(
    () => listenForPageEngagement(() => setEngaged(true)),
    [],
  );
  useEffect(
    () => watchIntroCompletion(() => setIntroComplete(true)),
    [],
  );

  if (!ready) return null;

  return (
    <>
      {shouldMountConsent({ engaged, introComplete, ready }) ? (
        <DeferredConsentManager>{null}</DeferredConsentManager>
      ) : null}
      <DeferredIntroGate />
      <HapticFeedback />
    </>
  );
}
