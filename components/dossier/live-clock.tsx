'use client';

import { useEffect, useState } from 'react';
import {
  createLocationClockFallback,
  formatLocationClock,
  formatVisitorRelativeOffset,
  type ClockLocation,
  type LocationClock,
} from '@/lib/dossier';

interface LiveClockProps {
  location: ClockLocation;
  className?: string;
}

export function LiveClock({ location, className }: LiveClockProps) {
  const [clock, setClock] = useState<(LocationClock & { relativeDelta: string }) | null>(null);
  const fallback = createLocationClockFallback(location);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock({
        ...formatLocationClock(now, location),
        relativeDelta: formatVisitorRelativeOffset(location.timezone, now.getTimezoneOffset()),
      });
    };

    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, [location.city, location.timezone]);

  return (
    <span className={['font-mono tabular-nums', className].filter(Boolean).join(' ')}>
      <time
        aria-label={clock?.accessibleLabel ?? fallback.accessibleLabel}
        dateTime={clock?.dateTime}
      >
        {clock?.display ?? fallback.display}
      </time>
      {clock && <span aria-hidden="true"> · {clock.relativeDelta}</span>}
    </span>
  );
}
