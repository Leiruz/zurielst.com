import { Reveal } from '@/components/dossier/reveal';
import type { Profile } from '@/content/schema';

interface FaqProps {
  profile: Profile;
}

export function Faq({ profile }: FaqProps) {
  return (
    <section id="faq" className="dossier-section bg-canvas-raised" aria-labelledby="faq-title">
      <div className="dossier-shell min-w-0">
        <Reveal>
          <p className="fig-label">Fig. 12. FAQ</p>
          <h2 id="faq-title" className="dossier-title mt-4 text-text-1">FAQ</h2>
        </Reveal>

        <Reveal className="mt-10 max-w-4xl">
          <div className="divide-y divide-line border-y border-line">
            {profile.faq.map((entry) => (
              <details key={entry.id} data-faq-entry="true" className="group min-w-0">
                <summary className="cursor-pointer py-5 pr-4 text-base font-medium leading-6 text-text-1 marker:text-text-3 sm:text-lg">
                  {entry.question}
                </summary>
                <p className="max-w-prose pb-6 pr-4 text-sm leading-6 text-text-2 sm:text-base sm:leading-[1.65]">{entry.answer}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
