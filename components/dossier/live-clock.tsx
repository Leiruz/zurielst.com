'use client';

import { useEffect, useState } from 'react';
import { formatSingaporeClock, type SingaporeClock } from '@/lib/dossier';
import { cn } from '@/lib/utils';

interface LiveClockProps {
  className?: string;
}

export function LiveClock({ className }: LiveClockProps) {
  const [clock, setClock] = useState<SingaporeClock | null>(null);

  useEffect(() => {
    const updateClock = () => {
      setClock(formatSingaporeClock(new Date()));
    };

    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <time
      className={cn('font-mono tabular-nums', className)}
      aria-label={clock?.accessibleLabel ?? 'Current time in Singapore: --:--:-- +08'}
      dateTime={clock?.dateTime}
    >
      {clock?.display ?? '--:--:-- +08'}
    </time>
  );
}
