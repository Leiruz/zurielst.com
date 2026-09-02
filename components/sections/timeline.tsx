import { ScrollFadeEffect } from '@/components/registry/scroll-fade-effect';
import { Experience01 } from '@/components/registry/experience-01';
import { groupTimelineExperience } from '@/components/registry/work-experience';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import type { Profile } from '@/content/schema';

interface TimelineProps {
  profile: Profile;
}

export function Timeline({ profile }: TimelineProps) {
  const experiences = groupTimelineExperience(profile.timeline);

  return (
    <section id="timeline" className="dossier-section bg-canvas" aria-labelledby="timeline-title">
      <div className="dossier-shell timeline-shell min-w-0">
        <Experience01 experiences={experiences}>
          <ScrollFadeEffect entrance>
            <p className="fig-label">Fig. 7. Timeline</p>
            <h2 id="timeline-title" className="dossier-title screen-line-top screen-line-bottom mt-4 text-text-1">
              Timeline <SectionAnchor href="#timeline" label="timeline" />
            </h2>
          </ScrollFadeEffect>
        </Experience01>
      </div>
    </section>
  );
}
