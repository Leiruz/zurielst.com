// Vendored from ncdai registry item "github-contributions" (chanhdai.com/r, MIT).
// Adapted to committed direct data without remote or overlay helpers.
import {
  ContributionGraph,
  ContributionLegend,
  type Activity,
} from '@/components/registry/contribution-graph';

export interface ContributionSnapshot {
  source: string;
  fetched_at: string;
  total_contributions: number;
  weeks: Array<{
    contributionDays: Array<{
      date: string;
      contributionCount: number;
    }>;
  }>;
}

export interface GitHubContributionsProps {
  contributions: Activity[];
  totalContributions: number;
}

function activityLevel(count: number): Activity['level'] {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

export function contributionSnapshotToActivities(snapshot: ContributionSnapshot): Activity[] {
  return snapshot.weeks.flatMap((week) => week.contributionDays.map((day) => ({
    date: day.date,
    count: day.contributionCount,
    level: activityLevel(day.contributionCount),
  })));
}

export function GitHubContributions({
  contributions,
  totalContributions,
}: GitHubContributionsProps) {
  return (
    <div data-slot="github-contributions" className="mt-6 max-w-full">
      <ContributionGraph
        data={contributions}
        summary={`${totalContributions} contributions in the last year, shown across 53 weeks.`}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-text-3">
          {totalContributions.toLocaleString('en')} contributions in the last year
        </p>
        <ContributionLegend />
      </div>
    </div>
  );
}
