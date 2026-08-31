// Vendored from ncdai registry item "contribution-graph" (chanhdai.com/r, MIT).
// Credit: https://www.kibo-ui.com/components/contribution-graph
// Adapted to native UTC date helpers and dossier heat tokens; see docs/components-map.md.
export interface Activity {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface ContributionGraphProps {
  data: Activity[];
  summary?: string;
}

interface ContributionCellTarget {
  closest?(selector: string): ContributionCellTarget | null;
  focus?(): void;
  getAttribute?(name: string): string | null;
  setAttribute?(name: string, value: string): void;
}

interface ContributionGraphRoot {
  addEventListener(
    type: 'focusin' | 'keydown',
    listener: (event: {
      key?: string;
      preventDefault?(): void;
      target: ContributionCellTarget | null;
    }) => void,
  ): void;
  querySelector(selector: string): ContributionCellTarget | null;
}

const DAYS_PER_WEEK = 7;
const BLOCK_SIZE = 9;
const BLOCK_GAP = 3;
const LABEL_HEIGHT = 20;
const HEAT_CLASSES = ['fill-heat-0', 'fill-heat-1', 'fill-heat-2', 'fill-heat-3', 'fill-heat-4'] as const;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function utcDay(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

function groupActivitiesByWeek(activities: Activity[]) {
  if (activities.length === 0) return [];

  const leadingEmptyDays = utcDay(activities[0].date);
  const padded: Array<Activity | undefined> = [
    ...Array.from({ length: leadingEmptyDays }, () => undefined),
    ...activities,
  ];
  return Array.from({ length: Math.ceil(padded.length / DAYS_PER_WEEK) }, (_, weekIndex) => (
    padded.slice(weekIndex * DAYS_PER_WEEK, (weekIndex + 1) * DAYS_PER_WEEK)
  ));
}

export function enhanceContributionGraph(root: ContributionGraphRoot | null) {
  if (!root) return;

  const findCell = (target: ContributionCellTarget | null) => (
    typeof target?.closest === 'function' ? target.closest('[data-contribution-cell]') : null
  );
  const setTabStop = (cell: ContributionCellTarget) => {
    root.querySelector('[data-contribution-cell][tabindex="0"]')
      ?.setAttribute?.('tabindex', '-1');
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

    const week = Number.parseInt(cell.getAttribute?.('data-contribution-week') ?? '', 10);
    const day = Number.parseInt(cell.getAttribute?.('data-contribution-day') ?? '', 10);
    if (!Number.isInteger(week) || !Number.isInteger(day)) return;

    const destination = root.querySelector(
      `[data-contribution-cell][data-contribution-week="${week + direction[0]}"][data-contribution-day="${day + direction[1]}"]`,
    );
    event.preventDefault?.();
    if (!destination) return;

    setTabStop(destination);
    destination.focus?.();
  });
}

const CONTRIBUTION_GRAPH_ENHANCEMENT_SCRIPT = `(${enhanceContributionGraph.toString()})(document.currentScript?.previousElementSibling ?? null);`;

export function ContributionGraph({ data, summary }: ContributionGraphProps) {
  const weeks = groupActivitiesByWeek(data);
  const width = Math.max(0, weeks.length * (BLOCK_SIZE + BLOCK_GAP) - BLOCK_GAP);
  const height = LABEL_HEIGHT + DAYS_PER_WEEK * (BLOCK_SIZE + BLOCK_GAP) - BLOCK_GAP;
  const firstDate = data[0]?.date;

  return (
    <>
      <div
        data-slot="contribution-graph"
        className="max-w-full overflow-x-auto pb-2 pt-5"
        role="region"
        aria-label={summary ?? 'GitHub contribution calendar, horizontally scrollable'}
      >
        <svg
          className="block overflow-visible"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label={`${data.length} days of GitHub contributions`}
        >
          <title>GitHub contributions</title>
          {weeks.map((week, weekIndex) => {
            const firstOfMonth = week.find((activity) => activity?.date.endsWith('-01'));
            const monthIndex = firstOfMonth
              ? Number.parseInt(firstOfMonth.date.slice(5, 7), 10) - 1
              : -1;

            return (
              <g key={weekIndex} data-week-column="true">
                {monthIndex >= 0 ? (
                  <text
                    data-month-label="true"
                    aria-hidden="true"
                    className="fill-text-3 font-mono text-[10px]"
                    dominantBaseline="hanging"
                    x={weekIndex * (BLOCK_SIZE + BLOCK_GAP)}
                    y={0}
                  >
                    {MONTH_NAMES[monthIndex]}
                  </text>
                ) : null}
                {week.map((activity, dayIndex) => {
                  if (!activity) return null;
                  const label = `${activity.date}: ${activity.count} contributions`;
                  return (
                    <g
                      key={activity.date}
                      className="contribution-cell"
                      data-contribution-cell="true"
                      data-contribution-day={dayIndex}
                      data-contribution-week={weekIndex}
                      tabIndex={activity.date === firstDate ? 0 : -1}
                      role="img"
                      aria-label={label}
                    >
                      <title>{label}</title>
                      <rect
                        className={`${HEAT_CLASSES[activity.level]} transition-opacity duration-150 hover:opacity-80`}
                        data-count={activity.count}
                        data-date={activity.date}
                        data-level={activity.level}
                        height={BLOCK_SIZE}
                        rx={2}
                        ry={2}
                        width={BLOCK_SIZE}
                        x={weekIndex * (BLOCK_SIZE + BLOCK_GAP)}
                        y={LABEL_HEIGHT + dayIndex * (BLOCK_SIZE + BLOCK_GAP)}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <script
        id="contribution-graph-enhancement"
        dangerouslySetInnerHTML={{ __html: CONTRIBUTION_GRAPH_ENHANCEMENT_SCRIPT }}
      />
    </>
  );
}

export function ContributionLegend() {
  return (
    <div
      data-contribution-legend="true"
      className="flex items-center gap-1.5 font-mono text-[0.625rem] text-text-3"
      aria-label="Contribution intensity legend"
    >
      <span>Less</span>
      {HEAT_CLASSES.map((heatClass, level) => (
        <svg key={heatClass} width={BLOCK_SIZE} height={BLOCK_SIZE} aria-hidden="true">
          <rect
            data-legend-level={level}
            className={heatClass}
            width={BLOCK_SIZE}
            height={BLOCK_SIZE}
            rx={2}
            ry={2}
          />
        </svg>
      ))}
      <span>More</span>
    </div>
  );
}
