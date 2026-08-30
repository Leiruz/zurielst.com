'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

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
    loading: () => <div className="flex h-8 w-24" />,
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

export function ClientEnhancements() {
  const [ready, setReady] = useState(false);

  useEffect(() => scheduleAfterPaint(() => setReady(true)), []);

  if (!ready) return null;

  return (
    <>
      <DeferredConsentManager>{null}</DeferredConsentManager>
      <DeferredIntroGate />
    </>
  );
}
