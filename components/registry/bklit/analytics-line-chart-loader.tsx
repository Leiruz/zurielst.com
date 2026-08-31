'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import type { AnalyticsChartSeriesPoint } from '@/lib/analytics-snapshot';

const AnalyticsLineChart = dynamic(
  () => import('./analytics-line-chart').then((module) => module.AnalyticsLineChart),
  { ssr: false },
);

interface AnalyticsLineChartLoaderProps {
  data: AnalyticsChartSeriesPoint[];
}

export function AnalyticsLineChartLoader({ data }: AnalyticsLineChartLoaderProps) {
  const boundaryRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const boundary = boundaryRef.current;
    if (!boundary || typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setIsNearViewport(true);
      observer.disconnect();
    }, { rootMargin: '320px 0px' });
    observer.observe(boundary);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={boundaryRef}
      aria-hidden="true"
      data-bklit-line-chart="true"
      data-series="visits views"
      className="bklit-chart-boundary"
    >
      {isNearViewport ? <AnalyticsLineChart data={data} /> : null}
    </div>
  );
}
