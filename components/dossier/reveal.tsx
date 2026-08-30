'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delayIndex?: number;
}

export function Reveal({ children, className, delayIndex = 0 }: RevealProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isVisible, setIsVisible] = useState(false);
  const cappedDelayIndex = Math.min(Math.max(Math.floor(delayIndex), 0), 4);
  const style = { '--reveal-delay': `${cappedDelayIndex * 40}ms` } as CSSProperties;

  useEffect(() => {
    const element = elementRef.current;

    if (prefersReducedMotion || !element || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    setIsVisible(false);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { rootMargin: '0px 0px -8%', threshold: 0.12 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <div
      ref={elementRef}
      className={cn('dossier-reveal', className)}
      data-reveal-state={isVisible ? 'visible' : 'hidden'}
      style={style}
    >
      {children}
    </div>
  );
}
