export interface AnalyticsDay {
  date: string;
  sampled: boolean;
  views: number;
  visits: number;
}

export interface AnalyticsSnapshot {
  generated_at: string;
  range: {
    from: string;
    to: string;
  };
  days: AnalyticsDay[];
}

export interface AnalyticsSummary {
  busiestDay: AnalyticsDay;
  sampled: boolean;
  views: number;
  visits: number;
}

export type AnalyticsChartSeriesPoint = {
  date: string;
  views: number;
  visits: number;
};

export interface AnalyticsChart {
  bottom: number;
  series: AnalyticsChartSeriesPoint[];
  ticks: Array<{ date: string; index: number; x: number }>;
  visitsArea: string;
  visitsLine: string;
  viewsLine: string;
}

const CHART_LEFT = 24;
const CHART_RIGHT = 936;
const CHART_TOP = 20;
const CHART_BOTTOM = 256;

function chartX(index: number, dayCount: number) {
  if (dayCount <= 1) return CHART_LEFT;
  return CHART_LEFT + (index / (dayCount - 1)) * (CHART_RIGHT - CHART_LEFT);
}

function chartY(value: number, maximum: number) {
  return CHART_BOTTOM - (value / maximum) * (CHART_BOTTOM - CHART_TOP);
}

function linePath(
  days: AnalyticsDay[],
  maximum: number,
  value: (day: AnalyticsDay) => number,
) {
  return days.map((day, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${command}${chartX(index, days.length).toFixed(2)},${chartY(value(day), maximum).toFixed(2)}`;
  }).join(' ');
}

export function summarizeAnalytics(snapshot: AnalyticsSnapshot): AnalyticsSummary {
  const fallback: AnalyticsDay = {
    date: snapshot.range.from,
    sampled: false,
    views: 0,
    visits: 0,
  };
  const firstDay = snapshot.days[0] ?? fallback;

  return snapshot.days.reduce<AnalyticsSummary>((summary, day) => ({
    busiestDay: day.visits > summary.busiestDay.visits ? day : summary.busiestDay,
    sampled: summary.sampled || day.sampled,
    views: summary.views + day.views,
    visits: summary.visits + day.visits,
  }), {
    busiestDay: firstDay,
    sampled: false,
    views: 0,
    visits: 0,
  });
}

export function buildAnalyticsChart(days: AnalyticsDay[]): AnalyticsChart {
  const maximum = Math.max(1, ...days.flatMap((day) => [day.views, day.visits]));
  const visitsLine = linePath(days, maximum, (day) => day.visits);
  const viewsLine = linePath(days, maximum, (day) => day.views);
  const lastX = chartX(Math.max(days.length - 1, 0), days.length).toFixed(2);
  const firstX = chartX(0, days.length).toFixed(2);
  const tickIndexes = [0, 7, 14, 21, Math.max(days.length - 1, 0)]
    .filter((index, position, indexes) => index < days.length && indexes.indexOf(index) === position);

  return {
    bottom: CHART_BOTTOM,
    series: days.map(({ date, views, visits }) => ({ date, views, visits })),
    ticks: tickIndexes.map((index) => ({
      date: days[index]?.date ?? '',
      index,
      x: chartX(index, days.length),
    })),
    visitsArea: visitsLine
      ? `${visitsLine} L${lastX},${CHART_BOTTOM} L${firstX},${CHART_BOTTOM} Z`
      : '',
    visitsLine,
    viewsLine,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function formatAnalyticsDate(date: string, includeYear = false) {
  const year = date.slice(0, 4);
  const month = MONTHS[Number.parseInt(date.slice(5, 7), 10) - 1] ?? '';
  const day = date.slice(8, 10);
  return [day, month, includeYear ? year : ''].filter(Boolean).join(' ');
}
