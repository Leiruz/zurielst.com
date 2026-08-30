import profileJson from '@/content/profile.json';
import contributionJson from '@/content/github-contributions.json';
import type { Profile } from '@/content/schema';
import { Footer } from '@/components/footer';
import { SiteNav } from '@/components/site-nav';
import { Terminal } from '@/components/terminal';
import { CommandPaletteLoader } from '@/components/command-palette-loader';
import { Contact } from '@/components/sections/contact';
import { IdentityHeader } from '@/components/sections/identity-header';
import { Introduction } from '@/components/sections/introduction';
import { CapabilityActs } from '@/components/sections/capability-acts';
import { ContributionHeatmap, type ContributionSnapshot } from '@/components/sections/contribution-heatmap';
import { Stack } from '@/components/sections/stack';
import { BrandsWall } from '@/components/sections/brands-wall';
import { SelectedWork } from '@/components/sections/selected-work';
import { Timeline } from '@/components/sections/timeline';
import { Education } from '@/components/sections/education';
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
  const resumeAvailable = hasPublicMedia('/media/resume.pdf');
  const githubUrl = profile.identity.socials.find((social) => social.platform === 'GitHub')?.url ?? profile.identity.github.url;
  const linkedInUrl = profile.identity.socials.find((social) => social.platform === 'LinkedIn')?.url ?? '';

  return (
    <div className="bp-grid min-h-screen overflow-x-clip">
      <SiteNav />
      <main>
        <IdentityHeader profile={profile} />
        <Introduction profile={profile} />
        <ContributionHeatmap data={contributions} />
        <CapabilityActs profile={profile} />
        <Stack profile={profile} />
        <SelectedWork profile={profile} />
        <Timeline profile={profile} />
        <Education profile={profile} />
        <ProofWall profile={profile} />
        <Products profile={profile} />
        <BrandsWall profile={profile} />
        <Faq profile={profile} />
        <Contact
          email={profile.identity.email}
          socials={profile.identity.socials}
          disclaimer={profile.chat.disclaimer}
          intentChips={profile.chat.intent_chips.slice(0, 4)}
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
      <CommandPaletteLoader
        email={profile.identity.email}
        githubUrl={githubUrl}
        linkedInUrl={linkedInUrl}
        sourceUrl="https://github.com/Leiruz/zurielst.com"
      />
    </div>
  );
}
