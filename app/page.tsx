import profileJson from '@/content/profile.json';
import contributionJson from '@/content/github-contributions.json';
import type { Profile } from '@/content/schema';
import { Footer } from '@/components/footer';
import { SiteNav } from '@/components/site-nav';
import { Terminal } from '@/components/terminal';
import { Contact } from '@/components/sections/contact';
import { IdentityHeader } from '@/components/sections/identity-header';
import { CapabilityActs } from '@/components/sections/capability-acts';
import { ContributionHeatmap, type ContributionSnapshot } from '@/components/sections/contribution-heatmap';
import { SelectedWork } from '@/components/sections/selected-work';
import { Timeline } from '@/components/sections/timeline';
import { hasPublicMedia } from '@/lib/media';

export default function Home() {
  const profile = profileJson as Profile;
  const contributions = contributionJson as ContributionSnapshot;
  const portraitAvailable = hasPublicMedia(profile.identity.portrait.image);
  const resumeAvailable = hasPublicMedia('/media/resume.pdf');

  return (
    <div className="bp-grid min-h-screen overflow-x-clip">
      <SiteNav />
      <main>
        <IdentityHeader profile={profile} portraitAvailable={portraitAvailable} />
        <ContributionHeatmap data={contributions} />
        <CapabilityActs profile={profile} />
        <SelectedWork profile={profile} />
        <Timeline profile={profile} />
        <Contact profile={profile} />
      </main>
      <Footer name={profile.identity.name} />
      <Terminal profile={profile} resumeAvailable={resumeAvailable} />
    </div>
  );
}
