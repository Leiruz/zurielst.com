import { SectionAnchor } from '@/components/dossier/section-anchor';
import { AnalyticsLineChartLoader } from '@/components/registry/bklit/analytics-line-chart-loader';
import {
  formatAnalyticsDate,
  summarizeAnalytics,
  type AnalyticsSnapshot,
} from '@/lib/analytics-snapshot';

interface Metrics01Props {
  data: AnalyticsSnapshot;
}

const numberFormatter = new Intl.NumberFormat('en-US');

export function Metrics01({ data }: Metrics01Props) {
  const summary = summarizeAnalytics(data);
  const summarySentence = `Over the trailing 30 days, Cloudflare Web Analytics recorded ${numberFormatter.format(summary.visits)} visits and ${numberFormatter.format(summary.views)} views. The busiest day was ${formatAnalyticsDate(summary.busiestDay.date, true)} with ${numberFormatter.format(summary.busiestDay.visits)} visits.`;

  return (
    <div
      data-registry-block="metrics-01"
      className="mt-4 border-x border-line py-8"
    >
      <div className="screen-line-top screen-line-bottom">
        <div data-metrics-divider="true" className="screen-line-bottom px-4 pb-6">
          <h2 id="insights-title" className="dossier-title text-text-1">
            Visitor insights <SectionAnchor href="#insights" label="visitor insights" />
          </h2>
          <p className="dossier-prose mt-4 text-text-2">
            A committed, cookieless view of how this dossier is read.
          </p>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid grid-cols-1 sm:grid-cols-3"
          >
            <div className="hidden border-r border-line sm:block" />
            <div className="hidden border-r border-line sm:block" />
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-3">
            <Metric label="30-day visits" name="visits" value={numberFormatter.format(summary.visits)} />
            <Metric label="30-day views" name="views" value={numberFormatter.format(summary.views)} />
            <div
              data-insight-metric="busiest-day"
              className="relative flex min-w-0 flex-col justify-between gap-2 border-b border-line p-4 sm:border-b-0"
            >
              <dt className="text-sm leading-4 text-text-3">Busiest day</dt>
              <dd className="font-mono text-lg font-semibold leading-none tabular-nums text-text-1">
                <time dateTime={summary.busiestDay.date}>
                  {formatAnalyticsDate(summary.busiestDay.date)}
                </time>
                <span className="mt-1 block text-xs font-normal leading-4 text-text-3">
                  {numberFormatter.format(summary.busiestDay.visits)} visits
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <figure className="min-w-0 px-4 pb-4 pt-8">
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
          <AnalyticsLineChartLoader data={data.days} />
          <figcaption className="mt-4 font-mono text-xs leading-5 text-text-3">
            Fig. 13. Daily visits and views, trailing 30 days. Source: Cloudflare Web Analytics, committed snapshot.
          </figcaption>
          {summary.sampled ? (
            <p className="mt-2 font-mono text-xs leading-5 text-text-3">
              Sampled estimate: at least one daily count was reported from an adaptively sampled interval.
            </p>
          ) : null}
        </figure>
      </div>
    </div>
  );
}
interface MetricProps {
  label: string;
  name: 'views' | 'visits';
  value: string;
}

function Metric({ label, name, value }: MetricProps) {
  return (
    <div
      data-insight-metric={name}
      className="relative flex min-w-0 flex-col justify-between gap-2 border-b border-line p-4 sm:border-b-0"
    >
      <dt className="text-sm leading-4 text-text-3">{label}</dt>
      <dd className="font-mono text-lg font-semibold leading-none tabular-nums text-text-1">{value}</dd>
    </div>
  );
}
