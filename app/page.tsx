import { Fragment } from 'react';
import profileJson from '@/content/profile.json';
import analyticsJson from '@/content/analytics-snapshot.json';
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
import { VisitorInsights } from '@/components/sections/visitor-insights';
import { Stack } from '@/components/sections/stack';
import { BrandsWall } from '@/components/sections/brands-wall';
import { SelectedWork } from '@/components/sections/selected-work';
import { Timeline } from '@/components/sections/timeline';
import { Education } from '@/components/sections/education';
import { ProofWall } from '@/components/sections/proof-wall';
import { Products } from '@/components/sections/products';
import { Faq } from '@/components/sections/faq';
import { hasPublicMedia } from '@/lib/media';
import type { AnalyticsSnapshot } from '@/lib/analytics-snapshot';
import { withSiteUtm } from '@/lib/outbound-links';
import {
  GLOBAL_SECTION_SHORTCUTS,
  installGlobalSectionShortcuts,
} from '@/lib/section-shortcuts';
import { installReturnToTop } from '@/lib/return-to-top';

const GLOBAL_SECTION_SHORTCUTS_SCRIPT = `(${installGlobalSectionShortcuts.toString()})(${JSON.stringify(GLOBAL_SECTION_SHORTCUTS)});`;
const RETURN_TO_TOP_SCRIPT = `(${installReturnToTop.toString()})(document.querySelector("[data-return-to-top]"));`;

const COPY_DISCLOSURE_STATE_SCRIPT = `(() => {
  ${RETURN_TO_TOP_SCRIPT}
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
  ${GLOBAL_SECTION_SHORTCUTS_SCRIPT}
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const opensPalette = key === "k" && (event.ctrlKey || event.metaKey);
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
  const analytics = analyticsJson as AnalyticsSnapshot;
  const contributions = contributionJson as ContributionSnapshot;
  const resumeAvailable = hasPublicMedia('/media/resume.pdf');
  const githubUrl = withSiteUtm(profile.identity.socials.find((social) => social.platform === 'GitHub')?.url ?? profile.identity.github.url);
  const linkedInUrl = withSiteUtm(profile.identity.socials.find((social) => social.platform === 'LinkedIn')?.url ?? '');
  const taglineKeywords = profile.identity.tagline.split('.').map((word) => word.trim()).filter(Boolean);

  return (
    <>
      <div className="bp-grid min-h-screen overflow-x-clip">
        <SiteNav />
        <main>
          <IdentityHeader profile={profile} />
          <Introduction profile={profile} />
          <ContributionHeatmap data={contributions} />
          <VisitorInsights data={analytics} />
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
          <div
            data-bookend-cta="true"
            className="border-t border-line bg-canvas py-14 md:py-16"
          >
            <div className="dossier-shell flex flex-col items-center gap-6 text-center">
              <h2 className="text-xl font-semibold tracking-tight text-text-3 md:text-3xl">
                <span className="text-text-3">One dossier. </span>
                {taglineKeywords.map((keyword, index) => (
                  <Fragment key={keyword}>
                    <span className="text-text-1">{keyword}.</span>
                    {index < taglineKeywords.length - 1 ? ' ' : null}
                  </Fragment>
                ))}
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href="#contact"
                  className="rounded-full bg-primary px-4 py-2 font-mono text-xs text-primary-foreground transition-opacity duration-150 hover:opacity-90"
                >
                  Get in touch
                </a>
                <a
                  href="#work"
                  className="rounded-full border border-line-strong bg-surface px-4 py-2 font-mono text-xs text-text-2 transition-colors duration-150 hover:bg-surface-hover hover:text-text-1"
                >
                  Selected work
                </a>
              </div>
            </div>
          </div>
        </main>
        <button
          type="button"
          className="return-to-top"
          data-return-to-top="true"
          data-visible="false"
          aria-label="Return to top"
          aria-hidden="true"
          tabIndex={-1}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m6 15 6-6 6 6" />
          </svg>
        </button>
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
