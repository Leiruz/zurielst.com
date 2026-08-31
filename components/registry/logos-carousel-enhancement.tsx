'use client';

import { useEffect } from 'react';

interface LogosCarouselEnhancementProps {
  direction?: 'ltr' | 'rtl';
  itemCount: number;
  targetId: string;
}

const CYCLE_INTERVAL_MS = 2400;

export function normalizeCarouselColumns(columns: readonly HTMLElement[], step: number) {
  for (const column of columns) {
    const logos = Array.from(column.querySelectorAll<HTMLElement>('[data-slot="logos-carousel-logo"]'));
    const target = logos[step % logos.length];
    for (const logo of logos) {
      logo.removeAttribute('data-exiting');
      logo.dataset.active = String(logo === target);
    }
  }
}

export function LogosCarouselEnhancement({
  direction = 'ltr',
  itemCount,
  targetId,
}: LogosCarouselEnhancementProps) {
  useEffect(() => {
    const carousel = document.getElementById(targetId);
    if (!carousel || itemCount < 2) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const columns = Array.from(carousel.querySelectorAll<HTMLElement>('[data-slot="logos-carousel-column"]'));
    let cycleId: ReturnType<typeof setInterval> | undefined;
    const timeoutIds = new Set<ReturnType<typeof setTimeout>>();
    let step = 0;
    let nearViewport = false;

    const pause = () => {
      if (cycleId !== undefined) clearInterval(cycleId);
      cycleId = undefined;
      for (const timeoutId of timeoutIds) clearTimeout(timeoutId);
      timeoutIds.clear();
      carousel.removeAttribute('data-cycling');
      normalizeCarouselColumns(columns, step);
    };
    const showStep = (nextStep: number) => {
      for (const [columnIndex, column] of columns.entries()) {
        const logos = Array.from(column.querySelectorAll<HTMLElement>('[data-slot="logos-carousel-logo"]'));
        const waveIndex = direction === 'rtl' ? columns.length - 1 - columnIndex : columnIndex;
        const staggerId = setTimeout(() => {
          timeoutIds.delete(staggerId);
          const current = logos.find((logo) => logo.dataset.active === 'true');
          const next = logos[nextStep % logos.length];
          if (!next || current === next) return;
          if (current) {
            current.dataset.active = 'false';
            current.dataset.exiting = 'true';
          }
          next.removeAttribute('data-exiting');
          next.dataset.active = 'true';
          if (!current) return;
          const exitId = setTimeout(() => {
            timeoutIds.delete(exitId);
            current.removeAttribute('data-exiting');
          }, 500);
          timeoutIds.add(exitId);
        }, waveIndex * 125);
        timeoutIds.add(staggerId);
      }
    };
    const syncPlayback = () => {
      const shouldPlay = nearViewport
        && document.visibilityState === 'visible'
        && !reducedMotion.matches;
      if (!shouldPlay) {
        pause();
        return;
      }
      if (cycleId !== undefined) return;
      carousel.dataset.cycling = 'true';
      cycleId = setInterval(() => {
        step += 1;
        showStep(step);
      }, CYCLE_INTERVAL_MS);
    };

    reducedMotion.addEventListener('change', syncPlayback);
    document.addEventListener('visibilitychange', syncPlayback);
    if (typeof IntersectionObserver === 'undefined') {
      nearViewport = true;
      syncPlayback();
      return () => {
        reducedMotion.removeEventListener('change', syncPlayback);
        document.removeEventListener('visibilitychange', syncPlayback);
        pause();
      };
    }

    const observer = new IntersectionObserver((entries) => {
      nearViewport = entries.some((entry) => entry.isIntersecting);
      syncPlayback();
    }, { rootMargin: '160px' });

    observer.observe(carousel);
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener('change', syncPlayback);
      document.removeEventListener('visibilitychange', syncPlayback);
      pause();
    };
  }, [direction, itemCount, targetId]);

  return null;
}
