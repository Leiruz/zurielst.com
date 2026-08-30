'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseMetric } from '@/lib/dossier';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion';

interface CountUpMetricProps {
  value: string;
  className?: string;
}

const COUNT_UP_DURATION_MS = 650;

export function CountUpMetric({ value, className }: CountUpMetricProps) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const hasCompleted = useRef(false);
  const parsedMetric = useMemo(() => parseMetric(value), [value]);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [displayedValue, setDisplayedValue] = useState(0);

  useEffect(() => {
    if (!parsedMetric) return;

    if (prefersReducedMotion || hasCompleted.current) {
      hasCompleted.current = true;
      setDisplayedValue(parsedMetric.value);
      return;
    }

    const element = elementRef.current;
    if (!element || !('IntersectionObserver' in window)) {
      hasCompleted.current = true;
      setDisplayedValue(parsedMetric.value);
      return;
    }

    let animationFrame = 0;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        hasCompleted.current = true;
        const startedAt = performance.now();
        const animate = (now: number) => {
          const progress = Math.min((now - startedAt) / COUNT_UP_DURATION_MS, 1);
          const easedProgress = 1 - Math.pow(1 - progress, 3);
          setDisplayedValue(parsedMetric.value * easedProgress);

          if (progress < 1) animationFrame = requestAnimationFrame(animate);
        };

        animationFrame = requestAnimationFrame(animate);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [parsedMetric, prefersReducedMotion]);

  if (!parsedMetric) {
    return <span className={['tabular-nums', className].filter(Boolean).join(' ')}>{value}</span>;
  }

  const display = `${parsedMetric.prefix}${displayedValue.toFixed(parsedMetric.fractionDigits)}${parsedMetric.suffix}`;

  return (
    <span ref={elementRef} className={['tabular-nums', className].filter(Boolean).join(' ')}>
      <span className="sr-only">{value}</span>
      <span className="dossier-count-up-static" aria-hidden="true" data-count-up-static>
        {value}
      </span>
      <span className="dossier-count-up-animated" aria-hidden="true" data-count-up-animated>
        {display}
      </span>
    </span>
  );
}
