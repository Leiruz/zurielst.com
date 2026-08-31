'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function NotFoundGameLoader() {
  const [GameCanvas, setGameCanvas] = useState<ComponentType | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [requested, setRequested] = useState(false);
  const [status, setStatus] = useState('Optional keyboard game is ready to load.');

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const updatePreference = () => {
      setReducedMotion(media.matches);
      if (media.matches) {
        setRequested(false);
        setGameCanvas(null);
        setStatus('Optional game disabled by reduced-motion preference.');
      }
    };

    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || prefersReducedMotion || !requested) return;

    let active = true;
    void import('./not-found-game-canvas').then((module) => {
      if (!active) return;
      setGameCanvas(() => module.NotFoundGameCanvas);
      setStatus('Game loaded. Use its start control when ready.');
    });

    return () => {
      active = false;
    };
  }, [reducedMotion, requested]);

  const requestGame = () => {
    const prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    if (prefersReducedMotion) {
      setReducedMotion(true);
      setStatus('Optional game disabled by reduced-motion preference.');
      return;
    }

    setRequested(true);
    setStatus('Loading optional game.');
  };

  return (
    <section className="not-found-game-shell mt-8 border-t border-line pt-6" aria-label="Optional 404 game">
      {GameCanvas ? (
        <GameCanvas />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-text-1">ZST BRICK RECOVERY</p>
            <p className="mt-1 text-sm text-text-3">Arrow keys move. Space starts or restarts.</p>
          </div>
          <button
            type="button"
            className="border border-line-strong bg-canvas px-4 py-2 font-mono text-xs text-text-1 hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-text-3"
            disabled={reducedMotion || requested}
            onClick={requestGame}
          >
            {requested ? 'Loading game' : 'Load game'}
          </button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{status}</p>
    </section>
  );
}
