import { ScrollFadeEffect } from '@/components/registry/scroll-fade-effect';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import type { Profile } from '@/content/schema';

interface EducationProps {
  profile: Profile;
}

function startYear(period: string) {
  return Number.parseInt(period.match(/\d{4}/)?.[0] ?? '0', 10);
}

export function Education({ profile }: EducationProps) {
  const entries = profile.timeline
    .filter((entry) => entry.type === 'education')
    .sort((left, right) => startYear(right.period) - startYear(left.period));

  return (
    <section id="education" className="dossier-section bg-canvas-raised" aria-labelledby="education-title">
      <div className="dossier-shell min-w-0">
        <ScrollFadeEffect entrance>
          <p className="fig-label">Fig. 9. Education</p>
          <h2 id="education-title" className="dossier-title mt-4 text-text-1">
            Education <SectionAnchor href="#education" label="education" />
          </h2>
        </ScrollFadeEffect>

        <div className="mt-10 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          {entries.map((entry, index) => (
            <ScrollFadeEffect entrance key={entry.id} delayIndex={index} className="h-full">
              <article className="dossier-card h-full min-w-0 bg-surface p-6">
                <p className="font-mono text-xs text-text-3">{entry.org}</p>
                <h3 className="mt-2 text-lg font-semibold text-text-1">{entry.title}</h3>
                <p className="mt-3 font-mono text-xs text-text-3">{entry.period}</p>
                <p className="mt-5 text-sm leading-6 text-text-2">{entry.summary}</p>
              </article>
            </ScrollFadeEffect>
          ))}
        </div>
      </div>
    </section>
  );
}
