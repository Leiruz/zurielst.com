import { ScrollFadeEffect } from '@/components/registry/scroll-fade-effect';
import {
  GitHubContributions as RegistryGitHubContributions,
  contributionSnapshotToActivities,
  type ContributionSnapshot,
} from '@/components/registry/github-contributions';

interface GitHubContributionsSectionProps {
  snapshot: ContributionSnapshot;
}

export function GitHubContributionsSection({ snapshot }: GitHubContributionsSectionProps) {
  const activities = contributionSnapshotToActivities(snapshot);
  const sourcePath = snapshot.source.match(/github\.com\/[^/\s,]+/)?.[0] ?? snapshot.source;
  const caption = `Fig. 3. ${snapshot.total_contributions} contributions in the last year. Source: ${sourcePath}, committed build-time snapshot.`;

  return (
    <section id="contributions" className="dossier-section bg-canvas" aria-labelledby="contributions-title">
      <div className="dossier-shell min-w-0">
        <ScrollFadeEffect entrance>
          <p className="fig-label">Fig. 3. Contributions</p>
          <h2 id="contributions-title" className="sr-only">Contributions</h2>
          <RegistryGitHubContributions
            contributions={activities}
            totalContributions={snapshot.total_contributions}
          />
          <p className="mt-4 font-mono text-xs leading-5 text-text-3">
            {caption}
          </p>
        </ScrollFadeEffect>
      </div>
    </section>
  );
}
