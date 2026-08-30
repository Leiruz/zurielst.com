import Image from 'next/image';
import { Reveal } from '@/components/dossier/reveal';
import type { MediaRef, Profile, WorkCase } from '@/content/schema';
import { hasPublicMedia } from '@/lib/media';

interface SelectedWorkProps {
  profile: Profile;
}

export function SelectedWork({ profile }: SelectedWorkProps) {
  return (
    <section id="work" className="dossier-section bg-canvas-raised" aria-labelledby="work-title">
      <div className="dossier-shell min-w-0">
        <Reveal>
          <p className="fig-label">Fig. 4. Selected work</p>
          <h2 id="work-title" className="dossier-title mt-4 text-text-1">Selected work</h2>
        </Reveal>

        <div className="mt-10 grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2">
          {profile.work_cases.map((workCase, index) => (
            <Reveal key={workCase.id} delayIndex={index} className="h-full">
              <WorkCard workCase={workCase} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkCard({ workCase }: { workCase: WorkCase }) {
  const evidence = workCase.evidence.filter((item) => hasPublicMedia(item.media));
  const notes = [workCase.note, ...workCase.links.map((link) => link.note)].filter((note): note is string => Boolean(note));

  return (
    <article className="dossier-card flex h-full min-w-0 flex-col overflow-hidden bg-surface">
      {evidence.map((item) => <Evidence key={item.media} item={item} />)}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="dossier-eyebrow">{workCase.kicker}</p>
        <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h3 className="min-w-0 text-xl font-semibold tracking-tight text-text-1">{workCase.title}</h3>
          <p className="shrink-0 font-mono text-xs text-text-3">{workCase.period}</p>
        </div>
        <p className="mt-5 text-base leading-[1.65] text-text-2">{workCase.summary}</p>

        {workCase.stack.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {workCase.stack.map((item) => (
              <li key={item} className="rounded-full border border-line px-2.5 py-1 font-mono text-[0.7rem] text-text-3">{item}</li>
            ))}
          </ul>
        )}

        {workCase.links.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {workCase.links.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" title={link.note} className="font-mono text-xs text-text-2 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-1">
                {link.label} ↗
              </a>
            ))}
          </div>
        )}

        {notes.length > 0 && (
          <div className="mt-auto space-y-1 pt-6">
            {notes.map((note) => <p key={note} className="text-sm italic text-text-3">{note}</p>)}
          </div>
        )}
      </div>
    </article>
  );
}

function Evidence({ item }: { item: MediaRef }) {
  if (item.type === 'video') {
    return <video src={item.media} aria-label={item.alt} controls preload="metadata" className="aspect-video w-full object-cover" />;
  }

  return <Image src={item.media} alt={item.alt} width={960} height={540} className="aspect-video w-full object-cover" />;
}
