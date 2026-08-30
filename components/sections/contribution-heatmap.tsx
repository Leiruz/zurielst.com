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

export function ContributionHeatmap({ data }: ContributionHeatmapProps) {
  const sourcePath = data.source.match(/github\.com\/[^/\s,]+/)?.[0] ?? data.source;
  const summary = `${data.total_contributions} contributions in the last year, shown across ${data.weeks.length} weeks.`;

  return (
    <section id="contributions" className="dossier-section bg-canvas" aria-labelledby="contributions-title">
      <div className="dossier-shell min-w-0">
        <Reveal>
          <p className="fig-label">Fig. 2. Contributions</p>
          <h2 id="contributions-title" className="sr-only">Contributions</h2>
          <p className="sr-only">{summary}</p>

          <div className="mt-6 max-w-full overflow-x-auto pb-3" tabIndex={0} aria-label="Contribution calendar, horizontally scrollable">
            <div className="flex w-max gap-[2px]" aria-hidden="true">
              {data.weeks.map((week, weekIndex) => (
                <div key={weekIndex} data-week-column="true" className="grid grid-rows-7 gap-[2px]">
                  {week.contributionDays.map((day) => (
                    <span
                      key={day.date}
                      className={`size-2 rounded-[2px] ${HEAT_CLASSES[contributionHeatBucket(day.contributionCount)]}`}
                      title={`${day.date}: ${day.contributionCount} contributions`}
                    />
                  ))}
                  {Array.from({ length: Math.max(0, DAYS_PER_WEEK - week.contributionDays.length) }, (_, dayIndex) => (
                    <span key={`placeholder-${dayIndex}`} className="size-2" data-placeholder="true" />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 font-mono text-xs leading-5 text-text-3">
            Fig. 2. {data.total_contributions} contributions in the last year. Source: {sourcePath}, committed build-time snapshot.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
