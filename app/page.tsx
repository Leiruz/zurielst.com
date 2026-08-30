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
import { ProofWall } from '@/components/sections/proof-wall';
import { Products } from '@/components/sections/products';
import { Faq } from '@/components/sections/faq';
import { hasPublicMedia } from '@/lib/media';

const COPY_DISCLOSURE_STATE_SCRIPT = `(() => {
  document.querySelectorAll("details[data-copy-disclosure]").forEach((details) => {
    const summary = details.querySelector(":scope > summary");
    if (!summary) return;
    const syncExpandedState = () => summary.setAttribute("aria-expanded", String(details.open));
    syncExpandedState();
    details.addEventListener("toggle", syncExpandedState);
  });
})();`;

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
        <ProofWall profile={profile} />
        <Products profile={profile} />
        <Faq profile={profile} />
        <Contact
          email={profile.identity.email}
          socials={profile.identity.socials}
          disclaimer={profile.chat.disclaimer}
        />
      </main>
      <script
        id="copy-disclosure-state"
        dangerouslySetInnerHTML={{ __html: COPY_DISCLOSURE_STATE_SCRIPT }}
      />
      <Footer name={profile.identity.name} />
      <Terminal
        commands={profile.easter_eggs.terminal.commands}
        source={profile.easter_eggs.terminal.source}
        email={profile.identity.email}
        gamesUrl={profile.easter_eggs.towerblock.url}
        resumeAvailable={resumeAvailable}
      />
    </div>
  );
}
