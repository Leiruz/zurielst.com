import { Reveal } from '@/components/dossier/reveal';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import type { Profile } from '@/content/schema';

interface BrandsWallProps {
  profile: Profile;
}

export function BrandsWall({ profile }: BrandsWallProps) {
  return (
    <section id="brands" className="dossier-section bg-canvas" aria-labelledby="brands-title">
      <div className="dossier-shell min-w-0">
        <Reveal>
          <p className="fig-label">Fig. 11. Worked with</p>
          <h2 id="brands-title" className="dossier-title mt-4 text-text-1">
            Worked with <SectionAnchor href="#brands" label="worked with" />
          </h2>
        </Reveal>

        <div data-brand-grid="true" className="mt-10 grid gap-px overflow-hidden border border-line bg-border sm:grid-cols-2 lg:grid-cols-3">
          {profile.stack_brands.brands.map((brand, index) => (
            <Reveal key={brand.name} delayIndex={index} className="h-full bg-canvas">
              <article data-brand-tile="true" className="h-full min-w-0 bg-canvas p-6">
                <h3 className="text-xl font-semibold tracking-tight text-text-1">{brand.name}</h3>
                <p className="mt-3 text-sm leading-6 text-text-2">{brand.context}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <p className="mt-5 max-w-4xl font-mono text-[0.68rem] leading-5 text-text-3">
          {profile.stack_brands.disclaimer}
        </p>
      </div>
    </section>
  );
}
