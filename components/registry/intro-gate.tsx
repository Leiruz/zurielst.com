'use client';

/**
 * IntroGate (ours, not vendored): plays the apple-hello-effect once per
 * session as a fixed overlay. Plan rev 3 contract:
 * - session-gated (sessionStorage), skippable, absent under reduced motion
 * - the identity content underneath is prerendered, so LCP never waits on it
 * - storage failures degrade to "show nothing"
 */

import { useEffect, useRef, useState } from 'react';
import { AppleHelloEffectEnglish } from '@/components/registry/apple-hello-effect-english';

const SEEN_KEY = 'zst-hello-seen';

export function hasSeenIntro(
  storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage,
): boolean {
  try {
    const seen = storage.getItem(SEEN_KEY) === '1';
    if (!seen) storage.setItem(SEEN_KEY, '1');
    return seen;
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Storage is unavailable, so the up-front check will keep failing closed.
  }
}

export function IntroGate() {
  // Render nothing on the server and on first client paint: hydration-neutral.
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const introWasVisibleRef = useRef(false);

  useEffect(() => {
    const seen = hasSeenIntro();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (seen || reduced) {
      if (reduced) markSeen();
      return;
    }
    const activeElement = document.activeElement;
    previousFocusRef.current =
      activeElement instanceof HTMLElement ? activeElement : null;
    setShow(true);
  }, []);

  useEffect(() => {
    if (show) {
      introWasVisibleRef.current = true;
      return;
    }
    if (!introWasVisibleRef.current) return;

    introWasVisibleRef.current = false;
    const previousFocus = previousFocusRef.current;
    previousFocusRef.current = null;
    if (previousFocus?.isConnected) previousFocus.focus();
  }, [show]);

  const dismiss = () => {
    markSeen();
    setLeaving(true);
    window.setTimeout(() => setShow(false), 500);
  };

  if (!show) return null;

  return <IntroOverlay leaving={leaving} onDismiss={dismiss} />;
}

export function IntroOverlay({
  leaving,
  onDismiss,
}: {
  leaving: boolean;
  onDismiss: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Intro animation"
      onKeyDown={(event) => {
        if (leaving || event.key !== 'Tab') return;
        event.preventDefault();
        event.currentTarget
          .querySelector<HTMLButtonElement>('button')
          ?.focus();
      }}
      className={
        'fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ' +
        (leaving ? 'pointer-events-none opacity-0' : 'opacity-100')
      }
    >
      <AppleHelloEffectEnglish
        aria-hidden="true"
        className="h-16 text-text-1 sm:h-20"
        onAnimationComplete={() => window.setTimeout(onDismiss, 350)}
      />
      <button
        type="button"
        autoFocus
        aria-label="Skip intro"
        onClick={onDismiss}
        className="absolute bottom-8 rounded-full border border-line-strong px-4 py-1.5 font-mono text-xs text-text-3 transition-colors hover:text-text-1"
      >
        skip
      </button>
    </div>
  );
}
