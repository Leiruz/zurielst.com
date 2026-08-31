import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const analyticsChartRuntime = vi.hoisted(() => ({
  lineChartProps: [] as Array<Record<string, unknown>>,
  reducedMotion: false,
}));

vi.mock('@/components/dossier/use-prefers-reduced-motion', () => ({
  usePrefersReducedMotion: () => analyticsChartRuntime.reducedMotion,
}));

vi.mock('@/components/registry/bklit/charts/line-chart', async () => {
  const { createElement: createMockElement } = await import('react');

  return {
    default: (props: Record<string, unknown>) => {
      analyticsChartRuntime.lineChartProps.push(props);
      return createMockElement('div');
    },
    Line: () => null,
  };
});

import Home from '@/app/page';
import { AnalyticsLineChart } from '@/components/registry/bklit/analytics-line-chart';
import {
  shortDateFmt,
  weekdayDateFmt,
} from '@/components/registry/bklit/charts/chart-formatters';
import { VisitorInsights } from '@/components/sections/visitor-insights';
import snapshotJson from '@/content/analytics-snapshot.json';
import {
  buildAnalyticsChart,
  type AnalyticsSnapshot,
} from '@/lib/analytics-snapshot';
// @ts-expect-error The Vitest config exposes the stylesheet source as a virtual text module.
import styles from 'virtual:globals-css-source';

vi.mock('server-only', () => ({}));

describe('visitor insights section', () => {
  it('disables the Motion reveal when reduced motion is requested', () => {
    analyticsChartRuntime.lineChartProps = [];
    analyticsChartRuntime.reducedMotion = true;

    renderToStaticMarkup(createElement(AnalyticsLineChart, { data: [] }));

    expect(analyticsChartRuntime.lineChartProps.at(-1)?.animationDuration).toBe(0);
    analyticsChartRuntime.reducedMotion = false;
  });

  it('keeps the Bklit reveal timing when reduced motion is not requested', () => {
    analyticsChartRuntime.lineChartProps = [];
    analyticsChartRuntime.reducedMotion = false;

    renderToStaticMarkup(createElement(AnalyticsLineChart, { data: [] }));

    expect(analyticsChartRuntime.lineChartProps.at(-1)?.animationDuration).toBe(1100);
  });

  it('leaves touch gestures to page scrolling and browser zoom', () => {
    analyticsChartRuntime.lineChartProps = [];

    renderToStaticMarkup(createElement(AnalyticsLineChart, { data: [] }));

    expect(analyticsChartRuntime.lineChartProps.at(-1)?.style).toEqual({
      pointerEvents: 'none',
      touchAction: 'auto',
    });
  });

  it('formats analytics calendar dates in UTC', () => {
    const date = new Date('2026-08-30');

    expect(shortDateFmt.resolvedOptions().timeZone).toBe('UTC');
    expect(weekdayDateFmt.resolvedOptions().timeZone).toBe('UTC');
    expect(shortDateFmt.format(date)).toBe('Aug 30');
    expect(weekdayDateFmt.format(date)).toBe('Sun, Aug 30');
  });

  it('builds the Bklit series once with only date, visits, and views', () => {
    const chart = buildAnalyticsChart([
      { date: '2026-08-29', sampled: true, views: 9, visits: 4 },
      { date: '2026-08-30', sampled: false, views: 12, visits: 7 },
    ]);

    expect(chart.series).toEqual([
      { date: '2026-08-29', views: 9, visits: 4 },
      { date: '2026-08-30', views: 12, visits: 7 },
    ]);
  });

  it('renders the committed snapshot in the metrics-01 Insights structure', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const visits = snapshotJson.days.reduce((total, day) => total + day.visits, 0);
    const views = snapshotJson.days.reduce((total, day) => total + day.views, 0);
    const busiest = snapshotJson.days.reduce((current, day) => (
      day.visits > current.visits ? day : current
    ));
    const faqStart = markup.indexOf('<section id="faq"');
    const insightsStart = markup.indexOf('<section id="insights"');
    const contactStart = markup.indexOf('<section id="contact"');
    const insightsMarkup = markup.slice(insightsStart, contactStart);

    expect(insightsStart).toBeGreaterThan(faqStart);
    expect(contactStart).toBeGreaterThan(insightsStart);
    expect(insightsMarkup).toContain('aria-labelledby="insights-title"');
    expect(insightsMarkup).toContain('id="insights-title"');
    expect(insightsMarkup).toContain('>Visitor insights <a');
    expect(insightsMarkup).toContain('Fig. 13. Insights');
    expect(insightsMarkup).toContain('data-registry-block="metrics-01"');
    expect(insightsMarkup).toContain('screen-line-top screen-line-bottom');
    expect(insightsMarkup).toContain('data-metrics-divider="true"');

    expect(insightsMarkup.match(/data-insight-metric=/g)).toHaveLength(3);
    expect(insightsMarkup).toContain('data-insight-metric="visits"');
    expect(insightsMarkup).toContain('>30-day visits</dt>');
    expect(insightsMarkup).toContain(`>${visits.toLocaleString('en-US')}</dd>`);
    expect(insightsMarkup).toContain('data-insight-metric="views"');
    expect(insightsMarkup).toContain('>30-day views</dt>');
    expect(insightsMarkup).toContain(`>${views.toLocaleString('en-US')}</dd>`);
    expect(insightsMarkup).toContain('data-insight-metric="busiest-day"');
    expect(insightsMarkup).toContain('>Busiest day</dt>');
    expect(insightsMarkup).toContain(`dateTime="${busiest.date}"`);
    expect(insightsMarkup).toContain(`${busiest.visits.toLocaleString('en-US')} visits`);

    const summaryStart = insightsMarkup.indexOf('data-analytics-summary="true"');
    const chartBoundaryStart = insightsMarkup.indexOf('data-bklit-line-chart="true"');
    expect(summaryStart).toBeGreaterThanOrEqual(0);
    expect(chartBoundaryStart).toBeGreaterThan(summaryStart);
    expect(insightsMarkup).toContain('data-series="visits views"');
    expect(insightsMarkup).toContain('data-chart-legend="true"');
    expect(insightsMarkup).toContain('>Visits</span>');
    expect(insightsMarkup).toContain('>Views</span>');
    expect(insightsMarkup).not.toMatch(/(?:NaN|Infinity)/);
    expect(insightsMarkup).not.toContain('unique');
    expect(insightsMarkup).not.toContain('Sessions');
    expect(insightsMarkup).not.toContain('Session duration');
    expect(insightsMarkup).not.toMatch(/13,573|16,017|100,563|380\.563/);
  });

  it('precedes the hidden chart with a summary and omits the daily data table', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const insightsStart = markup.indexOf('<section id="insights"');
    const contactStart = markup.indexOf('<section id="contact"');
    const insightsMarkup = markup.slice(insightsStart, contactStart);

    expect(insightsMarkup).toMatch(
      /<p[^>]*data-analytics-summary="true"[^>]*class="[^"]*sr-only[^"]*"[^>]*>[^<]+<\/p>\s*<div[^>]*data-bklit-line-chart="true"/,
    );
    expect(insightsMarkup).not.toContain('data-analytics-table="true"');
    expect(insightsMarkup).not.toContain('Daily data table');
    expect(insightsMarkup).not.toContain('<table');
    expect(insightsMarkup).not.toContain('data-analytics-day="true"');
    expect(insightsMarkup).toContain(
      'Fig. 13. Daily visits and views, trailing 30 days. Source: Cloudflare Web Analytics, committed snapshot.',
    );
    expect(insightsMarkup).toContain('Sampled estimate:');
  });

  it('uses the earliest busiest-day tie and omits the sampling note for unsampled data', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const days = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(from);
      date.setUTCDate(date.getUTCDate() + index);
      return {
        date: date.toISOString().slice(0, 10),
        sampled: false,
        views: index === 4 ? 8 : index === 5 ? 9 : 0,
        visits: index === 4 || index === 5 ? 5 : 0,
      };
    });
    const data: AnalyticsSnapshot = {
      generated_at: '2026-01-30T12:00:00.000Z',
      range: { from: days[0].date, to: days.at(-1)?.date ?? '' },
      days,
    };
    const markup = renderToStaticMarkup(createElement(VisitorInsights, { data }));
    const busiestStart = markup.indexOf('data-insight-metric="busiest-day"');
    const busiestMarkup = markup.slice(busiestStart, markup.indexOf('</div>', busiestStart));

    expect(busiestMarkup).toContain('dateTime="2026-01-05"');
    expect(busiestMarkup).not.toContain('dateTime="2026-01-06"');
    expect(markup).not.toContain('Sampled estimate:');
  });

  it('reserves the same responsive aspect ratio before and after the Bklit chart mounts', () => {
    expect(styles).toMatch(
      /\.bklit-chart-boundary\s*\{[^}]*aspect-ratio:\s*2\s*\/\s*1/,
    );
    expect(styles).toMatch(
      /\.bklit-analytics-chart\s*\{[^}]*aspect-ratio:\s*2\s*\/\s*1/,
    );
    const desktopStyles = styles.slice(styles.indexOf('@media (min-width: 48rem)'));
    expect(desktopStyles).toMatch(
      /\.bklit-chart-boundary\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*1/,
    );
    expect(desktopStyles).toMatch(
      /\.bklit-analytics-chart\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*1/,
    );
    expect(styles).toMatch(
      /\.bklit-chart-boundary\s*>\s*\.bklit-analytics-chart\s*\{[^}]*height:\s*100%[^}]*width:\s*100%/,
    );
    expect(styles).not.toContain('.analytics-chart-label');
  });
});
