import { CopyDisclosure } from '@/components/dossier/copy-disclosure';
import { Reveal } from '@/components/dossier/reveal';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import type { Profile, TimelineEntry } from '@/content/schema';

interface TimelineProps {
  profile: Profile;
}

const TAG_STYLES: Record<TimelineEntry['type'], string> = {
  role: 'border-line-strong bg-surface text-text-2',
  education: 'border-line bg-canvas-raised text-text-3',
  cca: 'border-line bg-canvas text-text-3',
};

export function Timeline({ profile }: TimelineProps) {
  return (
    <section id="timeline" className="dossier-section bg-canvas" aria-labelledby="timeline-title">
      <div className="dossier-shell min-w-0">
        <Reveal>
          <p className="fig-label">Fig. 8. Timeline</p>
          <h2 id="timeline-title" className="dossier-title mt-4 text-text-1">
            Timeline <SectionAnchor href="#timeline" label="timeline" />
          </h2>
        </Reveal>

        <ol className="relative mt-12 ml-2 border-l border-line-strong sm:ml-3">
          {profile.timeline.filter((entry) => entry.type !== 'education').map((entry, index) => (
            <li key={entry.id} className="relative pb-10 pl-7 last:pb-0 sm:pl-10">
              <span className="absolute -left-[5px] top-2 size-[9px] rounded-full border-2 border-canvas bg-text-3" aria-hidden="true" />
              <Reveal delayIndex={index}>
                <article className="min-w-0">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider ${TAG_STYLES[entry.type]}`}>
                    {entry.type}
                  </span>
                  <div className="mt-3 grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-text-3">{entry.org}</p>
                      <h3 className="mt-1 text-lg font-semibold text-text-1">{entry.title}</h3>
                    </div>
                    <p className="font-mono text-xs text-text-3 sm:text-right">{entry.period}</p>
                  </div>
                  <CopyDisclosure
                    id={entry.id}
                    kind="timeline"
                    paragraphClassName="dossier-prose pt-2 text-sm text-text-2"
                    text={entry.summary}
                  />
                </article>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
