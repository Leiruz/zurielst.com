import { Reveal } from '@/components/dossier/reveal';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import type { Profile } from '@/content/schema';

interface StackProps {
  profile: Profile;
}

export function Stack({ profile }: StackProps) {
  return (
    <section id="stack" className="dossier-section bg-canvas-raised" aria-labelledby="stack-title">
      <div className="dossier-shell min-w-0">
        <Reveal>
          <p className="fig-label">Fig. 5. Stack</p>
          <h2 id="stack-title" className="dossier-title mt-4 text-text-1">
            Stack <SectionAnchor href="#stack" label="stack" />
          </h2>
        </Reveal>

        <ol className="mt-10 divide-y divide-line border-y border-line">
          {profile.stack.categories.map((category, index) => (
            <li key={category.name} data-stack-category="true" className="py-7 sm:py-8">
              <Reveal delayIndex={index}>
                <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-start">
                  <div className="flex min-w-0 items-baseline gap-4">
                    <span className="shrink-0 font-mono text-4xl font-semibold leading-none text-text-1 opacity-[0.12]" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="min-w-0 text-lg font-semibold text-text-1">{category.name}</h3>
                  </div>
                  <ul className="flex min-w-0 flex-wrap gap-2">
                    {category.items.map((item) => (
                      <li
                        key={item}
                        data-stack-item="true"
                        className="rounded-full border border-line bg-surface/70 px-3 py-1.5 font-mono text-xs text-text-2"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
