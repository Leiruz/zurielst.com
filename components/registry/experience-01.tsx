// Vendored from ncdai registry item "experience-01" (chanhdai.com/r, MIT).
// Adapted to compose the dossier Timeline heading and profile-driven experience data.
import type { ReactNode } from 'react';
import {
  WorkExperience,
  type ExperienceOrganization,
} from '@/components/registry/work-experience';

interface Experience01Props {
  children: ReactNode;
  experiences: ExperienceOrganization[];
}

export function Experience01({ children, experiences }: Experience01Props) {
  return (
    <div data-slot="experience-01" className="experience-01 max-w-screen overflow-x-clip">
      <div className="container mx-auto px-4">
        <div className="border-x border-line py-8">
          {children}
          <WorkExperience
            className="bg-transparent *:screen-line-bottom"
            experiences={experiences}
          />
        </div>
      </div>
    </div>
  );
}
