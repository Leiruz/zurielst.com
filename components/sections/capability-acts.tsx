import { CopyDisclosure } from '@/components/dossier/copy-disclosure';
import { Reveal } from '@/components/dossier/reveal';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import type { Profile, Skill } from '@/content/schema';
import { splitDisclosureCopy } from '@/lib/dossier';

interface CapabilityActsProps {
  profile: Profile;
}

export function CapabilityActs({ profile }: CapabilityActsProps) {
  return (
    <section id="capabilities" className="bp-nodes relative border-t border-line" aria-labelledby="capabilities-title">
      <div className="dossier-shell py-[clamp(4rem,8vw,7rem)]">
        <Reveal>
          <p className="fig-label">Fig. 4. Capabilities</p>
          <h2 id="capabilities-title" className="dossier-title mt-4 text-text-1">
            Capabilities <SectionAnchor href="#capabilities" label="capabilities" />
          </h2>
        </Reveal>
      </div>

      {profile.capabilities.acts.map((act, index) => {
        const { teaser, remainder } = splitDisclosureCopy(act.narrative, 160);

        return (
          <div key={act.id} className={`border-t border-line ${index % 2 === 0 ? 'bg-canvas' : 'bg-canvas-raised'}`}>
            <div className="dossier-shell py-[clamp(3rem,6vw,5rem)]">
              <Reveal delayIndex={index}>
                <div className="grid min-w-0 gap-8 lg:grid-cols-[9rem_minmax(0,1fr)]">
                  <p className="font-mono text-[clamp(4.5rem,12vw,8rem)] font-semibold leading-none text-text-1 opacity-[0.08]" aria-hidden="true">
                    {String(act.act).padStart(2, '0')}
                  </p>
                  <div className="min-w-0">
                    <h3 className="dossier-title text-text-1">{act.title}</h3>
                    <p className="dossier-prose mt-5 text-text-2">{teaser}</p>
                    {remainder && (
                      <CopyDisclosure
                        id={act.id}
                        kind="capability"
                        paragraphClassName="dossier-prose pt-2 text-text-2"
                        text={remainder}
                      />
                    )}
                    <ul data-skill-grid={act.id} className="mt-8 grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
                      {act.skills.map((skill) => <SkillChip key={skill.name} skill={skill} />)}
                    </ul>
                  </div>
                </div>
              </Reveal>
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
      className="min-w-0 bg-surface px-3 py-2 text-sm text-text-2 transition-colors duration-150 hover:bg-surface-hover"
      title={skill.detail}
      aria-label={accessibleDetail}
    >
      <span className="break-words">{skill.name}</span>
      {skill.since && <span className="ml-2 whitespace-nowrap font-mono text-[0.7rem] text-text-3">{skill.since}</span>}
      {skill.detail && <span className="mt-1 block text-xs leading-4 text-text-3">{skill.detail}</span>}
    </li>
  );
}
