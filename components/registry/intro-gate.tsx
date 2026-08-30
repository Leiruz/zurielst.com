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
import {
  INTRO_COVER_ID,
  INTRO_HELLO_SIZE_CLASS,
  INTRO_REDUCED_MOTION_QUERY,
  INTRO_SEEN_KEY,
} from '@/components/registry/intro-first-paint';

export function hasSeenIntro(
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): boolean {
  try {
    const availableStorage = storage ?? window.sessionStorage;
    const seen = availableStorage.getItem(INTRO_SEEN_KEY) === '1';
    if (seen) return true;

    availableStorage.setItem(INTRO_SEEN_KEY, '1');
    return availableStorage.getItem(INTRO_SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, '1');
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
  const dismissingRef = useRef(false);
  const dismissTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const cover = document.getElementById(INTRO_COVER_ID);
    const stampedPending = root.dataset.intro === 'pending';
    const seen = hasSeenIntro();
    let reduced = true;
    try {
      reduced = window.matchMedia(INTRO_REDUCED_MOTION_QUERY).matches;
    } catch {
      // A missing media-query API fails closed just like unavailable storage.
    }

    if (!stampedPending || seen || reduced || !cover) {
      if (reduced) markSeen();
      root.dataset.intro = 'done';
      cover?.remove();
      return;
    }

    const activeElement = document.activeElement;
    previousFocusRef.current =
      activeElement instanceof HTMLElement ? activeElement : null;
    root.dataset.intro = 'active';
    setShow(true);
  }, []);

  useEffect(
    () => () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
      }
    },
    [],
  );

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
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    markSeen();
    document.documentElement.dataset.intro = 'leaving';
    setLeaving(true);
    dismissTimerRef.current = window.setTimeout(() => {
      document.documentElement.dataset.intro = 'done';
      document.getElementById(INTRO_COVER_ID)?.remove();
      dismissTimerRef.current = null;
      setShow(false);
    }, 500);
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
        'fixed inset-0 z-[101] flex items-center justify-center transition-opacity duration-500 ' +
        (leaving ? 'pointer-events-none opacity-0' : 'opacity-100')
      }
    >
      <AppleHelloEffectEnglish
        aria-hidden="true"
        className={`${INTRO_HELLO_SIZE_CLASS} text-white`}
        onAnimationComplete={() => window.setTimeout(onDismiss, 350)}
      />
      <button
        type="button"
        autoFocus
        aria-label="Skip intro"
        onClick={onDismiss}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-white/25 bg-black/60 px-3.5 py-1 font-mono text-xs text-white transition-colors hover:border-white/50 hover:bg-black hover:text-white"
      >
        skip
      </button>
    </div>
  );
}
