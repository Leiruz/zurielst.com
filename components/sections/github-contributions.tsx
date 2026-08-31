import {
  GitHubContributions as RegistryGitHubContributions,
  contributionSnapshotToActivities,
  type ContributionSnapshot,
} from '@/components/registry/github-contributions';

interface GitHubContributionsFigureProps {
  snapshot: ContributionSnapshot;
}

export function GitHubContributionsFigure({ snapshot }: GitHubContributionsFigureProps) {
  const activities = contributionSnapshotToActivities(snapshot);
  const sourcePath = snapshot.source.match(/github\.com\/[^/\s,]+/)?.[0] ?? snapshot.source;
  const caption = `Fig. 2. ${snapshot.total_contributions} contributions in the last year. Source: ${sourcePath}, committed build-time snapshot.`;

  return (
    <figure data-contributions-figure="true" className="min-w-0">
      <RegistryGitHubContributions
        contributions={activities}
        totalContributions={snapshot.total_contributions}
      />
      <figcaption className="mt-4 font-mono text-xs leading-5 text-text-3">
        {caption}
      </figcaption>
    </figure>
  );
}
