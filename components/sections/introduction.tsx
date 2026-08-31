import { LocalGreeting } from '@/components/dossier/local-greeting';
import { Reveal } from '@/components/dossier/reveal';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import type { Profile } from '@/content/schema';

interface IntroductionProps {
  profile: Profile;
}

export function Introduction({ profile }: IntroductionProps) {
  return (
    <section id="intro" className="dossier-section bg-canvas-raised" aria-labelledby="intro-title">
      <div className="dossier-shell min-w-0">
        <Reveal>
          <p className="fig-label">Fig. 2. Introduction</p>
          <h2
            id="intro-title"
            className="mt-4 min-h-[1.15em] text-[clamp(2.5rem,7vw,5rem)] font-light italic leading-[1.15] tracking-tight text-text-1"
          >
            <LocalGreeting />{' '}
            <SectionAnchor href="#intro" label="introduction" />
          </h2>
        </Reveal>

        <Reveal className="mt-10">
          <ul className="max-w-prose list-disc space-y-4 pl-5 marker:text-text-3">
            {profile.intro.bullets.map((bullet) => (
              <li key={bullet} data-intro-bullet="true" className="dossier-prose pl-2 text-text-2">
                {bullet}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
