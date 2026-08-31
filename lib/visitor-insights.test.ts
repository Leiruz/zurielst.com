import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import Home from '@/app/page';
import { VisitorInsights } from '@/components/sections/visitor-insights';
import snapshotJson from '@/content/analytics-snapshot.json';
import type { AnalyticsSnapshot } from '@/lib/analytics-snapshot';
// @ts-expect-error The Vitest config exposes the stylesheet source as a virtual text module.
import styles from 'virtual:globals-css-source';

vi.mock('server-only', () => ({}));

describe('visitor insights section', () => {
  it('renders the committed snapshot as static dossier metrics and an inline chart', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const visits = snapshotJson.days.reduce((total, day) => total + day.visits, 0);
    const views = snapshotJson.days.reduce((total, day) => total + day.views, 0);
    const busiest = snapshotJson.days.reduce((current, day) => (
      day.visits > current.visits ? day : current
    ));
    const contributionsStart = markup.indexOf('<section id="contributions"');
    const insightsStart = markup.indexOf('<section id="insights"');
    const capabilitiesStart = markup.indexOf('<section id="capabilities"');
    const insightsMarkup = markup.slice(insightsStart, capabilitiesStart);

    expect(insightsStart).toBeGreaterThan(contributionsStart);
    expect(capabilitiesStart).toBeGreaterThan(insightsStart);
    expect(insightsMarkup).toContain('aria-labelledby="insights-title"');
    expect(insightsMarkup).toContain('id="insights-title"');
    expect(insightsMarkup).toContain('>Visitor insights <a');
    expect(insightsMarkup).toContain('Fig. 4. Insights');

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
    const svgStart = insightsMarkup.indexOf('<svg');
    expect(summaryStart).toBeGreaterThanOrEqual(0);
    expect(svgStart).toBeGreaterThan(summaryStart);
    expect(insightsMarkup.slice(svgStart, insightsMarkup.indexOf('>', svgStart) + 1))
      .toMatch(/aria-hidden="true"[^>]*focusable="false"/);
    expect(insightsMarkup).toContain('data-series="visits-area"');
    expect(insightsMarkup).toContain('data-series="views"');
    expect(insightsMarkup).toContain('data-series="visits"');
    expect(insightsMarkup.match(/data-date-tick="true"/g)).toHaveLength(5);
    expect(insightsMarkup).toContain('data-chart-legend="true"');
    expect(insightsMarkup).toContain('>Visits</span>');
    expect(insightsMarkup).toContain('>Views</span>');
    expect(insightsMarkup).not.toMatch(/(?:NaN|Infinity)/);
    expect(insightsMarkup).not.toContain('unique');
  });

  it('precedes the hidden chart with a summary and exposes all days in a collapsed table', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const insightsStart = markup.indexOf('<section id="insights"');
    const capabilitiesStart = markup.indexOf('<section id="capabilities"');
    const insightsMarkup = markup.slice(insightsStart, capabilitiesStart);
    const detailsTag = insightsMarkup.match(/<details[^>]*data-analytics-table="true"[^>]*>/)?.[0] ?? '';

    expect(insightsMarkup).toMatch(
      /<p[^>]*data-analytics-summary="true"[^>]*class="[^"]*sr-only[^"]*"[^>]*>[^<]+<\/p>\s*<svg/,
    );
    expect(detailsTag).not.toBe('');
    expect(detailsTag).not.toMatch(/\sopen(?:=|\s|>)/);
    expect(insightsMarkup).toContain('<summary');
    expect(insightsMarkup).toContain('Daily data table');
    expect(insightsMarkup).toContain('<caption class="sr-only">Daily Cloudflare Web Analytics observations</caption>');
    expect(insightsMarkup.match(/data-analytics-day="true"/g)).toHaveLength(30);
    expect(insightsMarkup.match(/scope="col"/g)).toHaveLength(4);
    expect(insightsMarkup.match(/scope="row"/g)).toHaveLength(30);
    expect(insightsMarkup).toContain(
      'Fig. 4. Daily visits and views, trailing 30 days. Source: Cloudflare Web Analytics, committed snapshot.',
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

  it('keeps date labels outside the scaled SVG at readable CSS pixels', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const insightsStart = markup.indexOf('<section id="insights"');
    const capabilitiesStart = markup.indexOf('<section id="capabilities"');
    const insightsMarkup = markup.slice(insightsStart, capabilitiesStart);
    const svgStart = insightsMarkup.indexOf('<svg');
    const svgEnd = insightsMarkup.indexOf('</svg>', svgStart);
    const labelsStart = insightsMarkup.indexOf('data-analytics-axis-labels="true"');

    expect(labelsStart).toBeGreaterThan(svgEnd);
    expect(insightsMarkup.slice(svgStart, svgEnd)).not.toContain('analytics-chart-label');
    expect(insightsMarkup.match(/data-analytics-date-label="true"/g)).toHaveLength(5);
    expect(styles).toMatch(/\.analytics-chart-label\s*\{\s*font-size:\s*12px/);
    expect(styles).not.toMatch(
      /@media\s*\(max-width:\s*40rem\)\s*\{[\s\S]*\.analytics-chart-label/,
    );
  });
});
