'use client';

import { useEffect, useState } from 'react';
import {
  createLocationClockFallback,
  formatLocationClock,
  type ClockLocation,
  type LocationClock,
} from '@/lib/dossier';
import { cn } from '@/lib/utils';

interface LiveClockProps {
  location: ClockLocation;
  className?: string;
}

export function LiveClock({ location, className }: LiveClockProps) {
  const [clock, setClock] = useState<LocationClock | null>(null);
  const fallback = createLocationClockFallback(location);

  useEffect(() => {
    const updateClock = () => {
      setClock(formatLocationClock(new Date(), location));
    };

    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, [location.city, location.timezone]);

  return (
    <time
      className={cn('font-mono tabular-nums', className)}
      aria-label={clock?.accessibleLabel ?? fallback.accessibleLabel}
      dateTime={clock?.dateTime}
    >
      {clock?.display ?? fallback.display}
    </time>
  );
}
