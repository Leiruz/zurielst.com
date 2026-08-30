'use client';

/**
 * IntroGate (ours, not vendored): plays the apple-hello-effect once per
 * session as a fixed overlay. Plan rev 3 contract:
 * - session-gated (sessionStorage), skippable, absent under reduced motion
 * - the identity content underneath is prerendered, so LCP never waits on it
 * - storage failures degrade to "show nothing" after the first paint check
 */

import { useEffect, useState } from 'react';
import { AppleHelloEffectEnglish } from '@/components/registry/apple-hello-effect-english';

const SEEN_KEY = 'zst-hello-seen';

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // storage unavailable: fine, the intro simply may replay next load
  }
}

export function IntroGate() {
  // Render nothing on the server and on first client paint: hydration-neutral.
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      seen = false;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (seen || reduced) {
      if (reduced) markSeen();
      return;
    }
    setShow(true);
  }, []);

  const dismiss = () => {
    markSeen();
    setLeaving(true);
    window.setTimeout(() => setShow(false), 500);
  };

  if (!show) return null;

  return (
    <div
      aria-hidden="true"
      className={
        'fixed inset-0 z-50 flex items-center justify-center bg-canvas transition-opacity duration-500 ' +
        (leaving ? 'pointer-events-none opacity-0' : 'opacity-100')
      }
    >
      <AppleHelloEffectEnglish
        className="h-16 text-text-1 sm:h-20"
        onAnimationComplete={() => window.setTimeout(dismiss, 350)}
      />
      <button
        type="button"
        onClick={dismiss}
        className="absolute bottom-8 rounded-full border border-line-strong px-4 py-1.5 font-mono text-xs text-text-3 transition-colors hover:text-text-1"
      >
        skip
      </button>
    </div>
  );
}
