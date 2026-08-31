import { ScrollFadeEffect } from '@/components/registry/scroll-fade-effect';
import { WorkExperience, groupTimelineExperience } from '@/components/registry/work-experience';
import { SectionAnchor } from '@/components/dossier/section-anchor';
import type { Profile } from '@/content/schema';

interface TimelineProps {
  profile: Profile;
}

export function Timeline({ profile }: TimelineProps) {
  const experiences = groupTimelineExperience(profile.timeline);

  return (
    <section id="timeline" className="dossier-section bg-canvas" aria-labelledby="timeline-title">
      <div className="dossier-shell min-w-0">
        <ScrollFadeEffect entrance>
          <p className="fig-label">Fig. 8. Timeline</p>
          <h2 id="timeline-title" className="dossier-title mt-4 text-text-1">
            Timeline <SectionAnchor href="#timeline" label="timeline" />
          </h2>
        </ScrollFadeEffect>

        <ScrollFadeEffect entrance delayIndex={1}>
          <WorkExperience experiences={experiences} />
        </ScrollFadeEffect>
      </div>
    </section>
  );
}
