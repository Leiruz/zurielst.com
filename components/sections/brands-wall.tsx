import { Reveal } from '@/components/dossier/reveal';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import type { Profile } from '@/content/schema';

interface BrandsWallProps {
  profile: Profile;
}

export function BrandsWall({ profile }: BrandsWallProps) {
  return (
    <section id="brands" className="bp-nodes dossier-section bg-canvas" aria-labelledby="brands-title">
      <div className="dossier-shell min-w-0">
        <Reveal>
          <p className="fig-label">Fig. 11. Worked with</p>
          <h2 id="brands-title" className="dossier-title mt-4 text-text-1">
            Worked with <SectionAnchor href="#brands" label="worked with" />
          </h2>
        </Reveal>

        <div data-brand-grid="true" className="relative mt-10 grid gap-px border border-line bg-border sm:grid-cols-2 lg:grid-cols-3">
          {profile.stack_brands.brands.map((brand, index) => (
            <Reveal key={brand.name} delayIndex={index} className="h-full bg-canvas">
              <article data-brand-tile="true" className="h-full min-w-0 bg-canvas p-6">
                <h3 className="text-xl font-semibold tracking-tight text-text-1">{brand.name}</h3>
                <p className="mt-3 text-sm leading-6 text-text-2">{brand.context}</p>
              </article>
            </Reveal>
          ))}
          <DecorPlus className="top-0 left-0 -translate-x-1/2 -translate-y-1/2" />
          <DecorPlus className="top-0 right-0 translate-x-1/2 -translate-y-1/2" />
          <DecorPlus className="bottom-0 left-0 -translate-x-1/2 translate-y-1/2" />
          <DecorPlus className="right-0 bottom-0 translate-x-1/2 translate-y-1/2" />
        </div>

        <p className="mt-5 max-w-4xl font-mono text-[0.68rem] leading-5 text-text-3">
          {profile.stack_brands.disclaimer}
        </p>
      </div>
    </section>
  );
}

function DecorPlus({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      className={`pointer-events-none absolute z-1 size-5 text-text-3 ${className}`}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
