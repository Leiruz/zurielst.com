import type { Profile } from '@/content/schema';
import { CountUpMetric } from '@/components/dossier/count-up-metric';
import { LiveClock } from '@/components/dossier/live-clock';
import { RoleRotator } from '@/components/dossier/role-rotator';
import { PortraitAvatar } from '@/components/sections/portrait-avatar';

export function IdentityHeader({ profile }: { profile: Profile }) {
  const { identity } = profile;
  const currentRole = profile.timeline.find((entry) => entry.type === 'role' && entry.org === identity.employer);
  const founderRecord = profile.timeline.find((entry) => entry.type === 'role' && entry.title === 'Founder');
  const education = profile.timeline.find((entry) => entry.type === 'education' && entry.org.includes('University'));
  const award = profile.proof_wall.awards[0];
  const nameBoundary = identity.name.lastIndexOf(' ');
  const givenNames = identity.name.slice(0, nameBoundary);
  const familyName = identity.name.slice(nameBoundary + 1);

  return (
    <section id="identity" className="relative overflow-hidden py-[clamp(4rem,9vw,8rem)]" aria-labelledby="identity-title">
      <div className="bp-hatch pointer-events-none absolute inset-y-0 left-0 hidden w-12 border-r border-line xl:block" aria-hidden="true" />
      <div className="bp-hatch pointer-events-none absolute inset-y-0 right-0 hidden w-12 border-l border-line xl:block" aria-hidden="true" />

      <div className="dossier-shell relative">
        <p className="fig-label absolute right-4 top-0 sm:right-8">Fig. 1. Identity</p>
        <div className="grid gap-10 pt-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-start">
          <div className="min-w-0">
            <div className="mb-7 flex size-24 items-center justify-center overflow-hidden rounded-full border border-line-strong bg-surface font-mono text-2xl font-semibold text-text-1">
              <PortraitAvatar {...identity.portrait} name={identity.name} />
            </div>

            <h1 id="identity-title" className="dossier-display flex flex-wrap items-center gap-x-3 gap-y-1 text-text-1">
              <span>{givenNames}</span>
              <span className="whitespace-nowrap inline-flex items-center gap-x-3">
                <span>{familyName}</span>
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-ring text-sm text-white" role="img" aria-label="verified">
                ✓
                </span>
              </span>
            </h1>
            <p className="mt-5 font-mono text-sm uppercase tracking-[0.16em] text-text-3">{identity.tagline}</p>
            <p className="dossier-body mt-5 text-text-2">{identity.bio_hook}</p>
            <p className="mt-5 min-h-7 text-lg text-text-1">
              <RoleRotator roles={identity.roles} />
            </p>

            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
              {identity.socials.map((social) => (
                <a key={social.platform} href={social.url} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-text-2 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-1">
                  {social.platform} ↗
                </a>
              ))}
            </div>
          </div>

          <dl className="grid min-w-0 grid-cols-1 border-t border-line text-sm sm:grid-cols-2 lg:grid-cols-1">
            {currentRole && <DossierRow label="Role" value={`${currentRole.title} @ ${currentRole.org}`} />}
            {founderRecord && <DossierRow label={founderRecord.title} value={`${founderRecord.org}, ${founderRecord.period}`} />}
            <div className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b border-line py-3 font-mono">
              <dt className="text-text-3">Location</dt>
              <dd className="min-w-0 text-text-1">
                {identity.location.city} {identity.location.timezone} <LiveClock location={identity.location} className="ml-1 text-text-3" />
              </dd>
            </div>
            {education && <DossierRow label="Education" value={`${education.title}, ${education.org}`} />}
            {award && <DossierRow label="Award" value={`${award.title}, ${award.year}`} />}
            <div className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b border-line py-3 font-mono">
              <dt className="text-text-3">Email</dt>
              <dd className="min-w-0 break-all"><a href={`mailto:${identity.email}`} className="text-text-1 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-2">{identity.email}</a></dd>
            </div>
            <div className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b border-line py-3 font-mono">
              <dt className="text-text-3">Resume</dt>
              <dd className="min-w-0"><a href="/media/resume.pdf" download className="text-text-1 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-2">DOWNLOAD PDF</a></dd>
            </div>
          </dl>
        </div>

        <dl className="mt-14 grid grid-cols-1 border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {identity.metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 border-b border-r border-line bg-canvas/70 p-5">
              <dt className="text-sm text-text-3">{metric.label}</dt>
              <dd className="mt-2 break-words font-mono text-xl font-semibold text-text-1"><CountUpMetric value={metric.value} /></dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function DossierRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b border-line py-3 font-mono">
      <dt className="text-text-3">{label}</dt>
      <dd className="min-w-0 text-text-1">{value}</dd>
    </div>
  );
}
