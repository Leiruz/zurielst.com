'use client';

import Grid from './charts/grid';
import LineChart, { Line } from './charts/line-chart';
import { ChartTooltip } from './charts/tooltip';

import { usePrefersReducedMotion } from '@/components/dossier/use-prefers-reduced-motion';
import type { AnalyticsChartSeriesPoint } from '@/lib/analytics-snapshot';

interface AnalyticsLineChartProps {
  data: AnalyticsChartSeriesPoint[];
}

export function AnalyticsLineChart({ data }: AnalyticsLineChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <LineChart
      animationDuration={prefersReducedMotion ? 0 : 1100}
      aspectRatio=""
      className="bklit-analytics-chart"
      data={data}
      margin={{ top: 16, right: 32, bottom: 24, left: 32 }}
      style={{ pointerEvents: 'none', touchAction: 'auto' }}
    >
      <Grid
        horizontal
        hideHorizontalEdgeLines
        stroke="var(--line-strong)"
        strokeDasharray="0"
      />
      <Line
        dataKey="views"
        stroke="var(--text-2)"
        strokeWidth={1.25}
      />
      <Line
        dataKey="visits"
        stroke="var(--ring)"
        strokeWidth={1.75}
      />
      <ChartTooltip />
    </LineChart>
  );
}
