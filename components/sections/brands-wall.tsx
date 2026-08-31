import dynamic from 'next/dynamic';
import { LogosCarousel } from '@/components/registry/logos-carousel';
import { ScrollFadeEffect } from '@/components/registry/scroll-fade-effect';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import { BrandIcon } from '@/components/sections/brand-icons';
import type { BrandName } from '@/components/sections/brand-icons';
import type { Profile } from '@/content/schema';

const LogosCarouselEnhancement = dynamic(
  () => import('@/components/registry/logos-carousel-enhancement')
    .then((module) => module.LogosCarouselEnhancement),
);

const BRAND_CAROUSEL_ID = 'worked-with-logos';

interface BrandsWallProps {
  profile: Profile;
}

export function BrandsWall({ profile }: BrandsWallProps) {
  return (
    <section id="brands" className="dossier-section bg-canvas" aria-labelledby="brands-title">
      <div className="dossier-shell min-w-0">
        <ScrollFadeEffect entrance>
          <p className="fig-label">Fig. 3. Worked with</p>
          <h2 id="brands-title" className="dossier-title mt-4 text-text-1">
            Worked with <SectionAnchor href="#brands" label="worked with" />
          </h2>
        </ScrollFadeEffect>

        <LogosCarousel id={BRAND_CAROUSEL_ID} className="mt-10">
          {profile.stack_brands.brands.map((brand, index) => (
            <article
              key={brand.name}
              data-brand-item="true"
              className="brand-carousel-card h-full min-w-0 bg-canvas p-5"
              style={{ '--brand-delay-index': index } as React.CSSProperties}
            >
              <BrandIcon
                name={brand.name as BrandName}
                className="size-9 text-text-1"
              />
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-text-1">{brand.name}</h3>
              <p className="mt-2 text-sm leading-6 text-text-2">{brand.context}</p>
            </article>
          ))}
        </LogosCarousel>
        <LogosCarouselEnhancement
          direction="ltr"
          targetId={BRAND_CAROUSEL_ID}
          itemCount={profile.stack_brands.brands.length}
        />

        <p className="mt-5 max-w-4xl font-mono text-[0.68rem] leading-5 text-text-3">
          {profile.stack_brands.disclaimer}
        </p>
      </div>
    </section>
  );
}
