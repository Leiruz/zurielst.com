// Vendored from ncdai registry item "work-experience" (chanhdai.com/r, MIT).
// Adapted for raw dossier periods and CopyDisclosure; see docs/components-map.md.
import { CopyDisclosure } from '@/components/dossier/copy-disclosure';
import type { TimelineEntry } from '@/content/schema';

export interface ExperiencePosition {
  id: string;
  period: string;
  summary: string;
  title: string;
  type: Exclude<TimelineEntry['type'], 'education'>;
}

export interface ExperienceOrganization {
  organization: string;
  positions: ExperiencePosition[];
}

export interface WorkExperienceProps {
  className?: string;
  experiences: ExperienceOrganization[];
}

export function groupTimelineExperience(entries: TimelineEntry[]): ExperienceOrganization[] {
  const organizations = new Map<string, ExperienceOrganization>();

  for (const entry of entries) {
    if (entry.type === 'education') continue;

    const organization = organizations.get(entry.org) ?? {
      organization: entry.org,
      positions: [],
    };
    organization.positions.push({
      id: entry.id,
      period: entry.period,
      summary: entry.summary,
      title: entry.title,
      type: entry.type,
    });
    organizations.set(entry.org, organization);
  }

  return [...organizations.values()];
}

export function WorkExperience({ className, experiences }: WorkExperienceProps) {
  return (
    <div
      data-slot="work-experience"
      className={['mt-12 divide-y divide-line border-y border-line', className].filter(Boolean).join(' ')}
    >
      {experiences.map((experience) => (
        <article
          key={experience.organization}
          data-work-organization="true"
          className="grid gap-5 py-8 md:grid-cols-[minmax(11rem,0.35fr)_minmax(0,1fr)] md:gap-10"
        >
          <header className="min-w-0">
            <h3 className="text-lg font-semibold text-text-1">{experience.organization}</h3>
            {experience.positions.some((position) => position.period.endsWith('present')) ? (
              <p className="mt-2 inline-flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-wider text-text-3">
                <span className="size-1.5 rounded-full bg-heat-4" aria-hidden="true" />
                Current organization
              </p>
            ) : null}
          </header>

          <ol className="relative min-w-0 space-y-8 border-l border-line-strong pl-6">
            {experience.positions.map((position) => (
              <li key={position.id} data-work-position="true" className="relative min-w-0">
                <span
                  className="absolute -left-[1.72rem] top-1.5 size-2 rounded-full border border-canvas bg-text-3"
                  aria-hidden="true"
                />
                <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5">
                  <div className="min-w-0">
                    <span className="inline-flex rounded-full border border-line-strong bg-surface px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-text-3">
                      {position.type}
                    </span>
                    <h4 className="mt-2 text-base font-semibold text-text-1">{position.title}</h4>
                  </div>
                  <p className="font-mono text-xs text-text-3 sm:text-right">{position.period}</p>
                </div>
                <CopyDisclosure
                  id={position.id}
                  kind="timeline"
                  paragraphClassName="dossier-prose pt-2 text-sm text-text-2"
                  text={position.summary}
                />
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}
