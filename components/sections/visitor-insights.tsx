import 'server-only';

import { SectionAnchor } from '@/components/dossier/section-anchor';
import { ScrollFadeEffect } from '@/components/registry/scroll-fade-effect';
import {
  buildAnalyticsChart,
  formatAnalyticsDate,
  summarizeAnalytics,
  type AnalyticsSnapshot,
} from '@/lib/analytics-snapshot';

interface VisitorInsightsProps {
  data: AnalyticsSnapshot;
}

const numberFormatter = new Intl.NumberFormat('en-US');

export function VisitorInsights({ data }: VisitorInsightsProps) {
  const summary = summarizeAnalytics(data);
  const chart = buildAnalyticsChart(data.days);
  const summarySentence = `Over the trailing 30 days, Cloudflare Web Analytics recorded ${numberFormatter.format(summary.visits)} visits and ${numberFormatter.format(summary.views)} views. The busiest day was ${formatAnalyticsDate(summary.busiestDay.date, true)} with ${numberFormatter.format(summary.busiestDay.visits)} visits.`;

  return (
    <section id="insights" className="dossier-section bg-canvas-raised" aria-labelledby="insights-title">
      <ScrollFadeEffect entrance className="dossier-shell min-w-0">
        <p className="fig-label">Fig. 4. Insights</p>
        <h2 id="insights-title" className="dossier-title mt-4 text-text-1">
          Visitor insights <SectionAnchor href="#insights" label="visitor insights" />
        </h2>
        <p className="dossier-prose mt-4 text-text-2">
          A committed, cookieless view of how this dossier is read.
        </p>

        <dl className="mt-10 grid overflow-hidden rounded-xl border border-line bg-canvas sm:grid-cols-3">
          <div data-insight-metric="visits" className="min-w-0 border-b border-line p-5 sm:border-b-0 sm:border-r">
            <dt className="text-sm text-text-3">30-day visits</dt>
            <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums text-text-1">
              {numberFormatter.format(summary.visits)}
            </dd>
          </div>
          <div data-insight-metric="views" className="min-w-0 border-b border-line p-5 sm:border-b-0 sm:border-r">
            <dt className="text-sm text-text-3">30-day views</dt>
            <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums text-text-1">
              {numberFormatter.format(summary.views)}
            </dd>
          </div>
          <div data-insight-metric="busiest-day" className="min-w-0 p-5">
            <dt className="text-sm text-text-3">Busiest day</dt>
            <dd className="mt-2 font-mono text-xl font-semibold text-text-1">
              <time dateTime={summary.busiestDay.date}>{formatAnalyticsDate(summary.busiestDay.date)}</time>
              <span className="mt-1 block text-xs font-normal text-text-3">
                {numberFormatter.format(summary.busiestDay.visits)} visits
              </span>
            </dd>
          </div>
        </dl>

        <figure className="mt-10 min-w-0">
          <div data-chart-legend="true" className="mb-3 flex items-center justify-end gap-4 font-mono text-[0.7rem] text-text-3">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="block h-0.5 w-5 bg-ring" />
              Visits
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="block h-px w-5 bg-text-2 opacity-65" />
              Views
            </span>
          </div>
          <p data-analytics-summary="true" className="sr-only">{summarySentence}</p>
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 960 266"
            className="block w-full overflow-visible"
          >
            {[20, 138, chart.bottom].map((y) => (
              <line
                key={y}
                x1="24"
                x2="936"
                y1={y}
                y2={y}
                stroke="var(--line-strong)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path
              data-series="visits-area"
              d={chart.visitsArea}
              fill="var(--ring)"
              opacity="0.12"
            />
            <path
              data-series="views"
              d={chart.viewsLine}
              fill="none"
              stroke="var(--text-2)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.25"
              opacity="0.65"
              vectorEffect="non-scaling-stroke"
            />
            <path
              data-series="visits"
              d={chart.visitsLine}
              fill="none"
              stroke="var(--ring)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
              vectorEffect="non-scaling-stroke"
            />
            {chart.ticks.map((tick) => (
              <g key={tick.date} data-date-tick="true">
                <line
                  x1={tick.x}
                  x2={tick.x}
                  y1={chart.bottom}
                  y2={chart.bottom + 7}
                  stroke="var(--text-3)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
          </svg>
          <div
            aria-hidden="true"
            data-analytics-axis-labels="true"
            className="relative mt-2 h-4 font-mono text-text-3"
          >
            {chart.ticks.map((tick) => (
              <time
                key={tick.date}
                dateTime={tick.date}
                data-analytics-date-label="true"
                className="analytics-chart-label absolute top-0 whitespace-nowrap"
                style={{
                  left: `${(tick.x / 960) * 100}%`,
                  transform: tick.index === 0
                    ? undefined
                    : tick.index === data.days.length - 1
                      ? 'translateX(-100%)'
                      : 'translateX(-50%)',
                }}
              >
                {formatAnalyticsDate(tick.date)}
              </time>
            ))}
          </div>
          <figcaption className="mt-4 font-mono text-xs leading-5 text-text-3">
            Fig. 4. Daily visits and views, trailing 30 days. Source: Cloudflare Web Analytics, committed snapshot.
          </figcaption>
          {summary.sampled ? (
            <p className="mt-2 font-mono text-xs leading-5 text-text-3">
              Sampled estimate: at least one daily count was reported from an adaptively sampled interval.
            </p>
          ) : null}
        </figure>

        <details data-analytics-table="true" className="mt-8 border-y border-line py-1">
          <summary className="cursor-pointer py-4 font-mono text-xs text-text-2 marker:text-text-3">
            Daily data table
          </summary>
          <div className="max-w-full overflow-x-auto pb-4">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm text-text-2">
              <caption className="sr-only">Daily Cloudflare Web Analytics observations</caption>
              <thead className="border-b border-line font-mono text-xs text-text-3">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Date</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Views</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Visits</th>
                  <th scope="col" className="px-3 py-2 font-medium">Sampled estimate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.days.map((day) => (
                  <tr key={day.date} data-analytics-day="true">
                    <th scope="row" className="whitespace-nowrap px-3 py-2 font-normal">
                      <time dateTime={day.date}>{formatAnalyticsDate(day.date, true)}</time>
                    </th>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{numberFormatter.format(day.views)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{numberFormatter.format(day.visits)}</td>
                    <td className="px-3 py-2">{day.sampled ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </ScrollFadeEffect>
    </section>
  );
}
