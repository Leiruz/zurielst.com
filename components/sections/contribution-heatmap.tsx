import { ScrollFadeEffect } from '@/components/registry/scroll-fade-effect';
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

interface HeatmapEventTarget {
  closest?(selector: string): HeatmapCellTarget | null;
}

interface HeatmapCellTarget extends HeatmapEventTarget {
  focus?(): void;
  getAttribute?(name: string): string | null;
  setAttribute?(name: string, value: string): void;
}

interface HeatmapRoot {
  addEventListener(
    type: 'focusin' | 'keydown',
    listener: (event: {
      key?: string;
      preventDefault?(): void;
      target: HeatmapEventTarget | null;
    }) => void,
  ): void;
  querySelector(selector: string): HeatmapCellTarget | null;
}

const DAYS_PER_WEEK = 7;
const HEAT_CLASSES = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function enhanceContributionHeatmap(root: HeatmapRoot | null) {
  if (!root) return;

  const findCell = (target: HeatmapEventTarget | null) => {
    if (typeof target?.closest !== 'function') return null;
    return target.closest('[data-heatmap-week][data-heatmap-day]');
  };
  const setTabStop = (cell: HeatmapCellTarget) => {
    root.querySelector(
      '[data-heatmap-week][data-heatmap-day][tabindex="0"]',
    )?.setAttribute?.('tabindex', '-1');
    cell.setAttribute?.('tabindex', '0');
  };

  root.addEventListener('focusin', (event) => {
    const cell = findCell(event.target);
    if (cell) setTabStop(cell);
  });
  root.addEventListener('keydown', (event) => {
    const directions: Record<string, readonly [number, number]> = {
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
    };
    const direction = event.key ? directions[event.key] : undefined;
    const cell = findCell(event.target);
    if (!direction || !cell) return;

    const week = Number.parseInt(cell.getAttribute?.('data-heatmap-week') ?? '', 10);
    const day = Number.parseInt(cell.getAttribute?.('data-heatmap-day') ?? '', 10);
    if (!Number.isInteger(week) || !Number.isInteger(day)) return;

    event.preventDefault?.();
    const destination = root.querySelector(
      `[data-heatmap-week="${week + direction[0]}"][data-heatmap-day="${day + direction[1]}"]`,
    );
    if (!destination) return;

    setTabStop(destination);
    destination.focus?.();
  });
}

const CONTRIBUTION_HEATMAP_ENHANCEMENT_SCRIPT = `(${enhanceContributionHeatmap.toString()})(document.currentScript?.previousElementSibling ?? null);`;

export function ContributionHeatmap({ data }: ContributionHeatmapProps) {
  const sourcePath = data.source.match(/github\.com\/[^/\s,]+/)?.[0] ?? data.source;
  const summary = `${data.total_contributions} contributions in the last year, shown across ${data.weeks.length} weeks.`;
  const firstDayDate = data.weeks.flatMap((week) => week.contributionDays)[0]?.date;

  return (
    <section id="contributions" className="dossier-section bg-canvas" aria-labelledby="contributions-title">
      <div className="dossier-shell min-w-0">
        <ScrollFadeEffect entrance>
          <p className="fig-label">Fig. 3. Contributions</p>
          <h2 id="contributions-title" className="sr-only">Contributions</h2>
          <p className="sr-only">{summary}</p>

          <div className="mt-6 max-w-full overflow-x-auto pb-10 pt-6" role="region" aria-label="Contribution calendar, horizontally scrollable">
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
                      {week.contributionDays.map((day, dayIndex) => {
                        const tooltip = `${day.date}: ${day.contributionCount} contributions`;
                        return (
                          <span
                            key={day.date}
                            className={`heatmap-cell size-2 rounded-[2px] ${HEAT_CLASSES[contributionHeatBucket(day.contributionCount)]}`}
                            data-heatmap-day={dayIndex}
                            data-heatmap-week={weekIndex}
                            data-tooltip={tooltip}
                            tabIndex={day.date === firstDayDate ? 0 : -1}
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
          <script
            id="contribution-heatmap-enhancement"
            dangerouslySetInnerHTML={{ __html: CONTRIBUTION_HEATMAP_ENHANCEMENT_SCRIPT }}
          />

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
        </ScrollFadeEffect>
      </div>
    </section>
  );
}
