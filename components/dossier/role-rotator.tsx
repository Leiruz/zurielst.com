'use client';

import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion';

interface RoleRotatorProps {
  roles: readonly string[];
  className?: string;
}

const ROLE_ROTATION_INTERVAL_MS = 3000;

export function RoleRotator({ roles, className }: RoleRotatorProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion || roles.length < 2) {
      setActiveIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % roles.length);
    }, ROLE_ROTATION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [prefersReducedMotion, roles.length]);

  if (roles.length === 0) return null;

  return (
    <span className={['inline-block', className].filter(Boolean).join(' ')} aria-live="off">
      {roles[activeIndex]}
    </span>
  );
}
