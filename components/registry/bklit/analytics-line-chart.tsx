'use client';

import Grid from './charts/grid';
import LineChart, { Line } from './charts/line-chart';
import { ChartTooltip } from './charts/tooltip';

export interface AnalyticsLineChartPoint {
  date: string;
  views: number;
  visits: number;
}

interface AnalyticsLineChartProps {
  data: AnalyticsLineChartPoint[];
}

export function AnalyticsLineChart({ data }: AnalyticsLineChartProps) {
  const series: Record<string, unknown>[] = data.map(({ date, views, visits }) => ({
    date,
    views,
    visits,
  }));

  return (
    <LineChart
      aspectRatio=""
      className="bklit-analytics-chart"
      data={series}
      margin={{ top: 16, right: 32, bottom: 24, left: 32 }}
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
