import { LocalGreeting } from '@/components/dossier/local-greeting';
import { ScrollFadeEffect } from '@/components/registry/scroll-fade-effect';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import { GitHubContributionsFigure } from '@/components/sections/github-contributions';
import type { ContributionSnapshot } from '@/components/registry/github-contributions';
import type { Profile } from '@/content/schema';

interface IntroductionProps {
  contributions: ContributionSnapshot;
  profile: Profile;
}

export function Introduction({ contributions, profile }: IntroductionProps) {
  return (
    <section id="intro" className="dossier-section bg-canvas-raised" aria-labelledby="intro-title">
      <div className="dossier-shell min-w-0">
        <div
          data-intro-layout="true"
          className="grid min-w-0 gap-12 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-center"
        >
          <div data-intro-copy-column="true" className="min-w-0">
            <ScrollFadeEffect entrance>
              <p className="fig-label">Fig. 2. Introduction</p>
              <h2
                id="intro-title"
                className="mt-4 min-h-[1.15em] text-[clamp(2.5rem,7vw,5rem)] font-light italic leading-[1.15] tracking-tight text-text-1"
              >
                <LocalGreeting />{' '}
                <SectionAnchor href="#intro" label="introduction" />
              </h2>
            </ScrollFadeEffect>

            <ScrollFadeEffect entrance className="mt-10">
              <ul
                data-intro-copy="true"
                className="intro-copy list-disc space-y-4 pl-5 marker:text-text-3"
              >
                {profile.intro.bullets.map((bullet) => (
                  <li key={bullet} data-intro-bullet="true" className="dossier-prose pl-2 text-text-2">
                    {bullet}
                  </li>
                ))}
              </ul>
            </ScrollFadeEffect>
          </div>

          <ScrollFadeEffect
            entrance
            data-intro-contributions-column="true"
            className="min-w-0"
          >
            <GitHubContributionsFigure snapshot={contributions} />
          </ScrollFadeEffect>
        </div>
      </div>
    </section>
  );
}
