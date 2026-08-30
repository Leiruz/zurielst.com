import { Reveal } from '@/components/dossier/reveal';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import type { Profile } from '@/content/schema';

interface FaqProps {
  profile: Profile;
}

export function Faq({ profile }: FaqProps) {
  return (
    <section id="faq" className="bp-nodes dossier-section bg-canvas-raised" aria-labelledby="faq-title">
      <div className="dossier-shell min-w-0">
        <Reveal>
          <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2 md:overflow-clip">
            <div className="bg-canvas-raised p-6 sm:p-8">
              <div className="md:sticky md:top-24">
                <p className="fig-label">Fig. 12. FAQ</p>
                <h2 id="faq-title" className="dossier-title mt-4 text-text-1">
                  FAQ <SectionAnchor href="#faq" label="FAQ" />
                </h2>
                <p className="mt-6 text-sm text-text-2">
                  <span className="text-text-1">Can&apos;t find what you&apos;re looking for?</span>
                  {' Email '}
                  <a
                    href={`mailto:${profile.identity.email}`}
                    className="font-mono text-text-1 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-2"
                  >
                    {profile.identity.email}
                  </a>
                  {' or '}
                  <a
                    href="#contact"
                    className="font-mono text-text-1 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-2"
                  >
                    ask the assistant
                  </a>
                  .
                </p>
              </div>
            </div>
            <div className="bg-canvas-raised">
              <div className="divide-y divide-line">
                {profile.faq.map((entry) => (
                  <details key={entry.id} data-faq-entry="true" className="group min-w-0">
                    <summary className="cursor-pointer py-5 pr-4 text-base font-medium leading-6 text-text-1 marker:text-text-3 sm:text-lg">
                      {entry.question}
                    </summary>
                    <p className="max-w-prose pb-6 pr-4 text-sm leading-6 text-text-2 sm:text-base sm:leading-[1.65]">{entry.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
