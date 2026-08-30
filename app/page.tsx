import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';
import { Footer } from '@/components/footer';
import { SiteNav } from '@/components/site-nav';
import { Terminal } from '@/components/terminal';
import { Contact } from '@/components/sections/contact';
import { IdentityHeader } from '@/components/sections/identity-header';
import { hasPublicMedia } from '@/lib/media';

export default function Home() {
  const profile = profileJson as Profile;
  const portraitAvailable = hasPublicMedia(profile.identity.portrait.image);
  const resumeAvailable = hasPublicMedia('/media/resume.pdf');

  return (
    <div className="bp-grid min-h-screen overflow-x-clip">
      <SiteNav />
      <main>
        <IdentityHeader profile={profile} portraitAvailable={portraitAvailable} />
        <Contact profile={profile} />
      </main>
      <Footer name={profile.identity.name} />
      <Terminal profile={profile} resumeAvailable={resumeAvailable} />
    </div>
  );
}
