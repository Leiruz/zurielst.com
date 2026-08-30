import { Reveal } from '@/components/dossier/reveal';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import type { MediaRef, Product, Profile } from '@/content/schema';
import { hasPublicMedia } from '@/lib/media';

interface ProductsProps {
  profile: Profile;
}

export function Products({ profile }: ProductsProps) {
  return (
    <section id="products" className="bp-nodes dossier-section bg-canvas" aria-labelledby="products-title">
      <div className="dossier-shell min-w-0">
        <Reveal>
          <p className="fig-label">Fig. 10. Products</p>
          <h2 id="products-title" className="dossier-title mt-4 text-text-1">
            Products <SectionAnchor href="#products" label="products" />
          </h2>
        </Reveal>

        <div className="mt-10 grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {profile.products.map((product, index) => (
            <div key={product.id} className="h-full bg-surface transition-colors duration-150 hover:bg-surface-hover">
              <Reveal delayIndex={index} className="h-full">
                <ProductCard product={product} />
              </Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ product }: { product: Product }) {
  const availableMedia = product.media?.filter((item) => hasPublicMedia(item.media)) ?? [];
  const notes = [product.note, ...product.links.map((link) => link.note)].filter((note): note is string => Boolean(note));

  return (
    <article data-product-card="true" className="flex h-full min-w-0 flex-col overflow-hidden">
      {availableMedia.map((item) => <ProductMedia key={item.media} item={item} />)}
      <div className="flex flex-1 flex-col p-5">
        {product.origin_story && <p className="dossier-eyebrow">Origin story</p>}
        <div className={product.origin_story ? 'mt-3' : undefined}>
          <h3 className="text-lg font-semibold tracking-tight text-text-1">{product.name}</h3>
          {product.period && <p className="dim-mark mt-2 font-mono text-xs leading-5 text-text-3">{product.period}</p>}
        </div>

        <p className="mt-4 text-sm leading-6 text-text-2">{product.summary}</p>

        {product.stack.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {product.stack.map((item) => (
              <li key={item} className="rounded-full border border-line px-2.5 py-1 font-mono text-[0.7rem] text-text-3">{item}</li>
            ))}
          </ul>
        )}

        {product.links.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            {product.links.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" title={link.note} className="font-mono text-xs text-text-2 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-1">
                {link.label} ↗
              </a>
            ))}
          </div>
        )}

        {notes.length > 0 && (
          <div className="mt-auto space-y-1 pt-5">
            {notes.map((note) => <p key={note} className="text-sm italic leading-6 text-text-3">{note}</p>)}
          </div>
        )}
      </div>
    </article>
  );
}

function ProductMedia({ item }: { item: MediaRef }) {
  if (item.type === 'video') {
    return <video src={item.media} aria-label={item.alt} controls preload="metadata" className="aspect-video w-full object-cover" />;
  }

  return <img src={item.media} alt={item.alt} width={720} height={405} loading="lazy" decoding="async" className="aspect-video w-full object-cover" />;
}
