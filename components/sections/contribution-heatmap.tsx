import { Reveal } from '@/components/dossier/reveal';
import { contributionHeatBucket } from '@/lib/dossier';

interface ContributionDay {
  date: string;
  contributionCount: number;
}

interface ContributionWeek {
  contributionDays: ContributionDay[];
}

export interface ContributionSnapshot {
  source: string;
  fetched_at: string;
  total_contributions: number;
  weeks: ContributionWeek[];
}

interface ContributionHeatmapProps {
  data: ContributionSnapshot;
}

const DAYS_PER_WEEK = 7;
const HEAT_CLASSES = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function ContributionHeatmap({ data }: ContributionHeatmapProps) {
  const sourcePath = data.source.match(/github\.com\/[^/\s,]+/)?.[0] ?? data.source;
  const summary = `${data.total_contributions} contributions in the last year, shown across ${data.weeks.length} weeks.`;

  return (
    <section id="contributions" className="bp-nodes dossier-section bg-canvas" aria-labelledby="contributions-title">
      <div className="dossier-shell min-w-0">
        <Reveal>
          <p className="fig-label">Fig. 3. Contributions</p>
          <h2 id="contributions-title" className="sr-only">Contributions</h2>
          <p className="sr-only">{summary}</p>

          <div className="mt-6 max-w-full overflow-x-auto pb-10 pt-6" role="region" tabIndex={0} aria-label="Contribution calendar, horizontally scrollable">
            <div className="flex w-max gap-[2px]">
              {data.weeks.map((week, weekIndex) => {
                const firstOfMonth = week.contributionDays.find((day) => day.date.endsWith('-01'));
                const monthIndex = firstOfMonth ? Number.parseInt(firstOfMonth.date.slice(5, 7), 10) - 1 : -1;

                return (
                  <div key={weekIndex} className="heatmap-week relative">
                    {monthIndex >= 0 && (
                      <span data-month-label="true" aria-hidden="true" className="absolute -top-5 left-0 font-mono text-[0.625rem] text-text-3">
                        {MONTH_NAMES[monthIndex]}
                      </span>
                    )}
                    <div data-week-column="true" className="grid grid-rows-7 gap-[2px]">
                      {week.contributionDays.map((day) => {
                        const tooltip = `${day.date}: ${day.contributionCount} contributions`;
                        return (
                          <span
                            key={day.date}
                            className={`heatmap-cell size-2 rounded-[2px] ${HEAT_CLASSES[contributionHeatBucket(day.contributionCount)]}`}
                            data-tooltip={tooltip}
                            role="img"
                            aria-label={tooltip}
                          />
                        );
                      })}
                      {Array.from({ length: Math.max(0, DAYS_PER_WEEK - week.contributionDays.length) }, (_, dayIndex) => (
                        <span key={`placeholder-${dayIndex}`} className="size-2" data-placeholder="true" aria-hidden="true" />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div data-heat-legend="true" className="mt-1 flex items-center gap-1.5 font-mono text-[0.625rem] text-text-3" aria-label="Contribution intensity legend">
            <span>Less</span>
            {HEAT_CLASSES.map((heatClass, level) => (
              <span key={heatClass} data-legend-level={level} className={`size-2 rounded-[2px] ${heatClass}`} aria-hidden="true" />
            ))}
            <span>More</span>
          </div>

          <p className="mt-4 font-mono text-xs leading-5 text-text-3">
            Fig. 3. {data.total_contributions} contributions in the last year. Source: {sourcePath}, committed build-time snapshot.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
