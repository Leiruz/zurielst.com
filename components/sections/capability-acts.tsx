import { CopyDisclosure } from '@/components/dossier/copy-disclosure';
import { ScrollFadeEffect } from '@/components/registry/scroll-fade-effect';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import type { Profile, Skill } from '@/content/schema';
import { splitDisclosureCopy } from '@/lib/dossier';

interface CapabilityActsProps {
  profile: Profile;
}

export function CapabilityActs({ profile }: CapabilityActsProps) {
  return (
    <section id="capabilities" className="border-t border-line" aria-labelledby="capabilities-title">
      {profile.capabilities.acts.map((act, index) => {
        const { teaser, remainder } = splitDisclosureCopy(act.narrative, 160);
        const isFirstAct = index === 0;

        return (
          <div key={act.id} className={`${isFirstAct ? '' : 'border-t border-line '}${index % 2 === 0 ? 'bg-canvas' : 'bg-canvas-raised'}`}>
            <div className="dossier-shell py-[clamp(3rem,6vw,5rem)]">
              <ScrollFadeEffect entrance delayIndex={index}>
                <div data-capability-header={act.id} className="grid min-w-0 gap-8 lg:grid-cols-[9rem_minmax(0,1fr)]">
                  <p className="font-mono text-[clamp(4.5rem,12vw,8rem)] font-semibold leading-none text-text-1 opacity-[0.08]" aria-hidden="true">
                    {String(act.act).padStart(2, '0')}
                  </p>
                  <div className="min-w-0">
                    {isFirstAct ? (
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                        <h2 id="capabilities-title" className="dossier-title text-text-1">
                          {act.title} <SectionAnchor href="#capabilities" label="capabilities" />
                        </h2>
                        <p className="fig-label ml-auto">Fig. 4. Capabilities</p>
                      </div>
                    ) : (
                      <h3 className="dossier-title text-text-1">{act.title}</h3>
                    )}
                    <p className="dossier-prose mt-5 text-text-2">{teaser}</p>
                    {remainder && (
                      <CopyDisclosure
                        id={act.id}
                        kind="capability"
                        paragraphClassName="dossier-prose pt-2 text-text-2"
                        text={remainder}
                      />
                    )}
                    <ul data-skill-grid={act.id} className="mt-8 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {act.skills.map((skill) => <SkillChip key={skill.name} skill={skill} />)}
                    </ul>
                  </div>
                </div>
              </ScrollFadeEffect>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function SkillChip({ skill }: { skill: Skill }) {
  const accessibleDetail = [skill.name, skill.since, skill.detail].filter(Boolean).join(', ');

  return (
    <li
      className="min-w-0 rounded-lg border border-line bg-surface/70 px-3 py-2 text-sm text-text-2"
      title={skill.detail}
      aria-label={accessibleDetail}
    >
      <span className="break-words">{skill.name}</span>
      {skill.since && <span className="ml-2 whitespace-nowrap font-mono text-[0.7rem] text-text-3">{skill.since}</span>}
      {skill.detail && <span className="mt-1 block text-xs leading-4 text-text-3">{skill.detail}</span>}
    </li>
  );
}
