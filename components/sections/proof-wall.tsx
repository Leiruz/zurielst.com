import { Reveal } from '@/components/dossier/reveal';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import type {
  Award,
  Certification,
  CtfResult,
  Profile,
  Publication,
} from '@/content/schema';
import { hasPublicMedia } from '@/lib/media';

interface ProofWallProps {
  profile: Profile;
}

export function ProofWall({ profile }: ProofWallProps) {
  const proof = profile.proof_wall;

  return (
    <section id="proof" className="bp-nodes dossier-section bg-canvas-raised" aria-labelledby="proof-title">
      <div className="dossier-shell min-w-0">
        <Reveal>
          <p className="fig-label">Fig. 9. Accolades</p>
          <h2 id="proof-title" className="dossier-title mt-4 text-text-1">
            Accolades <SectionAnchor href="#proof" label="accolades" />
          </h2>
        </Reveal>

        <ProofGroup title="Certifications">
          {proof.certifications.map((item, index) => (
            <ProofCell key={item.id} delayIndex={index}>
              <CertificationTile item={item} />
            </ProofCell>
          ))}
        </ProofGroup>

        <ProofGroup title="Awards">
          {proof.awards.map((item, index) => (
            <ProofCell key={item.id} delayIndex={index}>
              <AwardTile item={item} />
            </ProofCell>
          ))}
        </ProofGroup>

        <ProofGroup title="CTF results">
          {proof.ctf_results.map((item, index) => (
            <ProofCell key={item.id} delayIndex={index}>
              <CtfTile item={item} />
            </ProofCell>
          ))}
        </ProofGroup>

        <ProofGroup title="Publications">
          {proof.publications.map((item, index) => (
            <ProofCell key={item.id} delayIndex={index}>
              <PublicationTile item={item} />
            </ProofCell>
          ))}
        </ProofGroup>

      </div>
    </section>
  );
}

function ProofGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 min-w-0" aria-labelledby={`proof-${title.toLowerCase().replaceAll(' ', '-')}`}>
      <h3 id={`proof-${title.toLowerCase().replaceAll(' ', '-')}`} className="border-b border-line pb-3 font-mono text-xs font-medium uppercase tracking-[0.14em] text-text-3">
        {title}
      </h3>
      <div className="mt-5 grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

function ProofTile({ children }: { children: React.ReactNode }) {
  return (
    <article data-proof-tile="true" className="flex h-full min-w-0 flex-col overflow-hidden">
      {children}
    </article>
  );
}

function ProofCell({
  children,
  delayIndex,
}: {
  children: React.ReactNode;
  delayIndex: number;
}) {
  return (
    <div className="h-full bg-surface transition-colors duration-150 hover:bg-surface-hover">
      <Reveal delayIndex={delayIndex} className="h-full">
        {children}
      </Reveal>
    </div>
  );
}

function ProofImage({ src, alt }: { src: string | undefined; alt: string }) {
  if (!hasPublicMedia(src)) return null;

  return <img src={src} alt={alt} width={720} height={405} loading="lazy" decoding="async" className="aspect-video w-full object-cover object-top" />;
}

function CertificationTile({ item }: { item: Certification }) {
  return (
    <ProofTile>
      <ProofImage src={item.image} alt={`${item.title}, issued by ${item.issuer}`} />
      <div className="flex flex-1 flex-col p-5">
        <h4 className="text-base font-semibold leading-snug text-text-1">{item.title}</h4>
        <p className="mt-3 font-mono text-xs leading-5 text-text-3">{[item.issuer, item.year].filter(Boolean).join(' · ')}</p>
        {item.validity && <p className="mt-2 font-mono text-xs leading-5 text-text-3">{item.validity}</p>}
        {item.caption && <p className="mt-4 text-sm leading-6 text-text-2">{item.caption}</p>}
      </div>
    </ProofTile>
  );
}

function AwardTile({ item }: { item: Award }) {
  return (
    <ProofTile>
      <ProofImage src={item.image} alt={`${item.title}, awarded by ${item.issuer}`} />
      <div className="flex flex-1 flex-col p-5">
        <h4 className="text-base font-semibold leading-snug text-text-1">{item.title}</h4>
        <p className="mt-3 font-mono text-xs leading-5 text-text-3">{item.issuer} · {item.year}</p>
        {item.caption && <p className="mt-4 text-sm leading-6 text-text-2">{item.caption}</p>}
      </div>
    </ProofTile>
  );
}

function CtfTile({ item }: { item: CtfResult }) {
  return (
    <ProofTile>
      <ProofImage src={item.image} alt={`${item.title}, organized by ${item.organizer}`} />
      <div className="flex flex-1 flex-col p-5">
        <h4 className="text-base font-semibold leading-snug text-text-1">{item.title}</h4>
        <p className="mt-3 font-mono text-xs leading-5 text-text-3">{item.organizer} · {item.year}</p>
        <p className="mt-3 font-mono text-xs leading-5 text-text-2">{item.result}</p>
        {item.caption && <p className="mt-4 text-sm leading-6 text-text-2">{item.caption}</p>}
      </div>
    </ProofTile>
  );
}

function PublicationTile({ item }: { item: Publication }) {
  return (
    <ProofTile>
      <div className="flex flex-1 flex-col p-5">
        <h4 className="text-base font-semibold leading-snug text-text-1">{item.title}</h4>
        <p className="mt-3 font-mono text-xs leading-5 text-text-3">{item.year} · {item.format}</p>
        <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-auto pt-6 font-mono text-xs text-text-2 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-1">
          Open publication ↗
        </a>
      </div>
    </ProofTile>
  );
}
