import profileJson from '@/content/profile.json';
import contributionJson from '@/content/github-contributions.json';
import type { Profile } from '@/content/schema';
import { Footer } from '@/components/footer';
import { SiteNav } from '@/components/site-nav';
import { Terminal } from '@/components/terminal';
import { CommandPaletteLoader } from '@/components/command-palette-loader';
import { ChatAssistant } from '@/components/chat/chat-assistant';
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

  document.addEventListener("click", async (event) => {
    if (!(event.target instanceof Element)) return;

    const chatTrigger = event.target.closest("[data-chat-open]");
    if (chatTrigger instanceof HTMLElement) {
      window.__dossierChatOpener = chatTrigger;
      window.dispatchEvent(new CustomEvent("dossier:chat-open", { detail: chatTrigger }));
    }

    const copyTrigger = event.target.closest("[data-copy-email]");
    if (!(copyTrigger instanceof HTMLElement)) return;
    const status = document.querySelector("[data-copy-email-status]");
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(copyTrigger.dataset.copyEmail ?? "");
      if (status) status.textContent = "✓ Copied";
    } catch {
      if (status) status.textContent = "Copy failed. Select the address instead.";
    }
  });

  const closeOpenAssistant = () => {
    const launcher = document.querySelector('.chat-launcher[aria-expanded="true"]');
    if (launcher instanceof HTMLButtonElement) launcher.click();
  };
  window.addEventListener("keydown", (event) => {
    const opensPalette = event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey);
    if (event.key === "Escape" || event.key === "\u0060" || opensPalette) {
      if (event.key === "Escape") event.preventDefault();
      closeOpenAssistant();
    }
  });
  ["dossier:command-palette-open", "dossier:terminal-open"].forEach((eventName) => {
    window.addEventListener(eventName, closeOpenAssistant);
  });

  const pulseAssistant = () => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const key = "zst-chat-assistant-attention-seen";
      if (window.sessionStorage.getItem(key) !== null) return;
      window.sessionStorage.setItem(key, "1");
      document.querySelector(".chat-launcher")?.setAttribute("data-attention", "true");
    } catch {}
  };
  const waitForIntro = () => {
    if (document.documentElement.dataset.intro === "done") {
      pulseAssistant();
      return;
    }
    const observer = new MutationObserver(() => {
      if (document.documentElement.dataset.intro !== "done") return;
      observer.disconnect();
      pulseAssistant();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-intro"],
    });
  };
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", waitForIntro, { once: true });
  } else {
    waitForIntro();
  }
})();`;

export default function Home() {
  const profile = profileJson as Profile;
  const contributions = contributionJson as ContributionSnapshot;
  const resumeAvailable = hasPublicMedia('/media/resume.pdf');
  const githubUrl = profile.identity.socials.find((social) => social.platform === 'GitHub')?.url ?? profile.identity.github.url;
  const linkedInUrl = profile.identity.socials.find((social) => social.platform === 'LinkedIn')?.url ?? '';

  return (
    <>
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
      <ChatAssistant
        disclaimer={profile.chat.disclaimer}
        intentChips={profile.chat.intent_chips.slice(0, 4)}
      />
    </>
  );
}
