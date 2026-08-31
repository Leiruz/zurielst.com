# Full Registry Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the portfolio's superseded custom UI with the owner-selected ncdai registry components while preserving the static export, dossier visual language, accessibility, and performance gates.

**Architecture:** Keep profile and snapshot data in server-rendered page composition, then adapt registry components at narrow client boundaries only where interaction needs Motion or browser APIs. Use static adapters for timeline and contributions, delegated haptic feedback for server-rendered controls, CSS-driven section entrances, and one controlled section observer for the desktop line navigation. The two verified Citadel testimonials become a fifteenth section before FAQ.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript strict, Tailwind CSS 4, Motion, next-themes, Vitest, Node test runner, Lighthouse.

## Global Constraints

- Author every commit as `Zuriel Shanley Tanyory <zurielst@u.nus.edu>`.
- End every commit with `Co-Authored-By: Codex <codex@openai.com>`.
- Create 3 to 6 logical commits, including this plan commit.
- Do not push.
- Do not commit `TASK-*.md`, `codex-m35.log`, `registry-stage/`, `extract-registry.mjs`, or `REVIEW-FINDINGS.txt`.
- Preserve the existing user changes in `next-env.d.ts` and `package-lock.json` and do not stage them.
- Do not use em dashes in copy, docs, code comments, or tests.
- Keep TypeScript strict and use test-first development wherever behavior is expressible.
- Preserve the Lighthouse mobile median gate at `0.90`.
- Raise only the Brotli JavaScript cap from `153600` to `200000`, with a comment citing the registry adoption.
- Keep the static export pure. The contribution UI must consume `content/github-contributions.json` and must not import a fetch or `unstable_cache` path.
- Preserve reduced-motion behavior, keyboard access, WebAudio theme clicks, section IDs, consecutive figure labels, the GitHub honesty caption, and the Brands disclaimer.
- Record every newly vendored registry item and its source in `docs/components-map.md`.

---

### Task 1: Identity and section motion registry adoption

**Files:**
- Fetch to untracked staging: `registry-stage/spotlight-logo.json`, `registry-stage/status-button.json`, `registry-stage/scroll-fade-effect.json`, `registry-stage/shimmering-text.json`, `registry-stage/text-flip.json`, `registry-stage/fluid-gradient-text.json`
- Create: `components/registry/spotlight-logo.tsx`
- Create: `components/registry/status-button.tsx`
- Create: `components/registry/scroll-fade-effect.tsx`
- Create: `components/registry/shimmering-text.tsx`
- Create: `components/registry/text-flip.tsx`
- Create: `components/registry/fluid-gradient-text.tsx`
- Create: `components/registry/deferred-registry-effects.tsx`
- Create: `lib/registry-identity-motion.test.tsx`
- Modify: `content/schema.ts`
- Modify: `content/profile.json`
- Modify: `content/profile.test.ts`
- Modify: `components/sections/identity-header.tsx`
- Modify: `components/site-nav.tsx`
- Modify: `components/footer.tsx`
- Modify: every section currently importing `components/dossier/reveal`
- Modify: `components/sections/visitor-insights.tsx`
- Modify: `components/sections/contact.tsx`
- Modify: `lib/dossier-components.test.ts`
- Modify: `lib/identity-header.test.ts`
- Modify: `scripts/perf-gate.test.mjs`
- Modify: `styles/globals.css`
- Modify: `docs/components-map.md`
- Delete: `components/dossier/reveal.tsx`
- Delete: `components/dossier/role-rotator.tsx`
- Delete: `lib/role-rotator.test.ts`

**Interfaces:**
- `identity.status` is exactly `{ label: "Open to opportunities", href: "mailto:zurielst@u.nus.edu" }`.
- `ScrollFadeEffect` preserves the registry overflow orientation API and adds `entrance?: boolean` plus `delayIndex?: number` for the owner-requested section entrance adaptation.
- `TextFlip` renders a span by default, keeps `aria-live="off"`, uses a three-second interval, and stops at the first role under reduced motion.
- `ShimmeringText` uses the registry default one-second pace and stops under reduced motion.
- `SpotlightLogo` renders only the ZST wordmark and remains decorative inside the existing terminal button.
- `StatusButton` supports an anchor `href` so mailto navigation works without JavaScript.
- `FluidGradientText` uses a unique gradient ID, dossier typography, and an accessible text label.
- The below-fold footer effect loads through `next/dynamic` with a server-visible plain `Zuriel` fallback.

- [ ] **Step 1: Add failing identity and registry integration assertions**

Add tests that require the new strict status field, `data-slot="spotlight-logo"`, `data-slot="status-button"`, the exact status label and mailto, `data-slot="shimmering-text"`, `data-slot="text-flip"`, `aria-live="off"`, `data-slot="fluid-gradient-text"`, and `data-scroll-fade-effect="entrance"`. Assert the identity section itself has no entrance wrapper. Replace the old Reveal test with a server-rendered ScrollFadeEffect test. Update the performance source test to prohibit the old role rotator and sweep names.

- [ ] **Step 2: Run the focused tests and verify red**

Run:

```powershell
npx vitest run content/profile.test.ts lib/identity-header.test.ts lib/dossier-components.test.ts lib/registry-identity-motion.test.tsx
```

Expected: FAIL because the status field and registry integration markers do not exist.

- [ ] **Step 3: Extract the six staged components**

Run:

```powershell
node extract-registry.mjs ./registry-stage . spotlight-logo status-button scroll-fade-effect shimmering-text text-flip fluid-gradient-text
```

Verify each expected target exists. The extractor does not rewrite imports, so correct all aliases in the adapted files.

- [ ] **Step 4: Implement the minimal identity and motion adaptations**

Add the mailto-specific strict status schema and profile value. Adapt the six vendored components to dossier tokens and the interfaces above. Replace all `Reveal` usages with `ScrollFadeEffect`, add the same entrance treatment to Insights and Contact, keep Identity unanimated, use the registry text components in Identity, use the spotlight in the nav wordmark, and render `Zuriel` through FluidGradientText in the footer or bottom bookend. Remove all old reveal, rotator, and light-up sweep code and their source-specific tests.

- [ ] **Step 5: Run focused and related tests and verify green**

Run:

```powershell
npx vitest run content/profile.test.ts lib/identity-header.test.ts lib/dossier-components.test.ts lib/registry-identity-motion.test.tsx lib/core-sections.test.ts lib/final-sections.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Stage only Task 1 files and commit with subject `feat(identity): adopt registry motion components` using the required author and trailer.

---

### Task 2: Theme, haptics, and slide-to-enter controls

**Files:**
- Fetch to untracked staging: `registry-stage/haptic.json`, `registry-stage/slide-to-unlock.json`, `registry-stage/theme-toggle-effect-circle-blur-top-left.json`
- Create: `lib/haptic.ts`
- Create: `components/registry/haptic-feedback.tsx`
- Create: `components/registry/haptic-feedback.test.ts`
- Create: `components/registry/icon-swap.tsx`
- Create: `components/registry/slide-to-unlock.tsx`
- Modify: `components/registry/theme-switcher.tsx`
- Modify: `components/registry/theme-switcher.test.tsx`
- Modify: `components/registry/intro-first-paint.tsx`
- Modify: `components/registry/intro-gate.tsx`
- Modify: `components/registry/intro-gate.test.tsx`
- Modify: `components/registry/client-enhancements.tsx`
- Modify: `components/site-nav.tsx`
- Modify: `components/footer-terminal-trigger.tsx`
- Modify: `components/chat/chat-assistant.tsx`
- Modify: `components/chat/chat.tsx`
- Modify: `components/sections/contact.tsx`
- Modify: `components/sections/proof-wall.tsx`
- Modify: `components/terminal.tsx`
- Modify: `app/page.tsx`
- Modify: `styles/globals.css`
- Modify: `docs/components-map.md`

**Interfaces:**
- `selectThemeChoice` starts a view transition only when `document.startViewTransition` exists and reduced motion is false; otherwise it changes theme immediately.
- The view-transition CSS is copied from `theme-toggle-effect-circle-blur-top-left`, including the blurred top-left mask and `350vmax` end size.
- The theme control keeps one action-labelled button, WebAudio feedback, and keyed IconSwap sun/moon content.
- `installHapticFeedback(root)` listens for clicks on `[data-haptic]` and calls the vendored `haptic` function once.
- Required haptic targets are theme, palette, terminal, chat launcher, chat send, return to top, copy email, View credential, and slide to enter.
- `SlideToUnlockHandle` is a real button and Enter or Space calls `onUnlock`.
- Reduced-motion intro sessions render an instant plain `Enter` button and use no leaving delay.

- [ ] **Step 1: Add failing theme, haptic, and intro assertions**

Extend theme tests with a fake view-transition dependency and require the IconSwap slots. Add haptic bridge tests for matching, nonmatching, and nested click targets. Replace skip assertions in intro tests with slide-to-enter, keyboard activation, focus trapping, mark-seen-on-completion, and the reduced-motion plain button path.

- [ ] **Step 2: Run the focused tests and verify red**

Run:

```powershell
npx vitest run components/registry/theme-switcher.test.tsx components/registry/intro-gate.test.tsx components/registry/haptic-feedback.test.ts
```

Expected: FAIL because view transitions, haptics, and the slider path are absent.

- [ ] **Step 3: Fetch and extract missing registry items**

Run:

```powershell
curl.exe -fsSL https://chanhdai.com/r/haptic.json -o registry-stage/haptic.json
curl.exe -fsSL https://chanhdai.com/r/slide-to-unlock.json -o registry-stage/slide-to-unlock.json
curl.exe -fsSL https://chanhdai.com/r/theme-toggle-effect-circle-blur-top-left.json -o registry-stage/theme-toggle-effect-circle-blur-top-left.json
node extract-registry.mjs ./registry-stage . icon-swap haptic slide-to-unlock theme-toggle-effect-circle-blur-top-left
```

Integrate the generated style payload into `styles/globals.css`, then remove the generated CSS JSON from the tracked change set.

- [ ] **Step 4: Implement the control adaptations and data markers**

Adapt IconSwap, theme selection, haptic delegation, SlideToUnlock keyboard behavior, the reduced-motion intro path, and the exact haptic targets. Preserve the intro seen flag, fade behavior for motion users, focus restoration, WebAudio, and action labels.

- [ ] **Step 5: Run focused and related tests and verify green**

Run:

```powershell
npx vitest run components/registry/theme-switcher.test.tsx components/registry/intro-gate.test.tsx components/registry/haptic-feedback.test.ts lib/chat-markup.test.ts lib/proof-media.test.ts lib/return-to-top.test.ts lib/terminal-focus.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Stage only Task 2 files and commit with subject `feat(controls): add registry theme and haptics` using the required author and trailer.

---

### Task 3: Static work experience and GitHub contribution adapters

**Files:**
- Fetch to untracked staging: `registry-stage/github-contributions.json`
- Create: `components/registry/work-experience.tsx`
- Create: `components/registry/contribution-graph.tsx`
- Create: `components/registry/github-contributions.tsx`
- Create: `components/sections/github-contributions.tsx`
- Create: `lib/registry-data-adapters.test.tsx`
- Modify: `components/sections/timeline.tsx`
- Modify: `app/page.tsx`
- Modify: `lib/core-sections.test.ts`
- Modify: `lib/capstone-components.test.ts`
- Modify: `lib/dossier.ts`
- Modify: `lib/dossier.test.ts`
- Modify: `lib/dossier-visual-direction.test.ts`
- Modify: `styles/globals.css`
- Modify: `docs/components-map.md`
- Delete: `components/sections/contribution-heatmap.tsx`
- Delete after extraction: `lib/get-cached-contributions.ts`

**Interfaces:**
- `groupTimelineExperience(entries)` filters out education, preserves first-seen organization order, groups Singtel into two positions, and produces seven organizations with eight positions.
- Each timeline position keeps the original title, period, type, and summary. `CopyDisclosure` remains the Read more and Read less composition.
- `contributionSnapshotToActivities(snapshot)` returns 365 `{ date, count, level }` records with levels `0` for zero, `1` for 1 to 2, `2` for 3 to 5, `3` for 6 to 9, and `4` for 10 or more.
- `GitHubContributions` accepts direct `Activity[]`, never a Promise, and has no import from `next/cache`, `fetch`, `date-fns`, tooltip, or spinner helpers.
- Contribution markup preserves 53 weeks, 12 month labels, five legend levels, 365 labelled keyboard cells, a single initial tab stop, arrow-key movement, and the exact honesty caption.

- [ ] **Step 1: Add failing adapter and replacement assertions**

Add tests for the seven-organization and eight-position grouping, Singtel position order, education exclusion, exact period strings, and CopyDisclosure count. Add tests for the 365 activity mapping, threshold levels, direct data prop, month labels, legend, roving keyboard focus, and exact caption. Update Home tests to require registry contribution slots and prohibit the custom heatmap module and helper.

- [ ] **Step 2: Run the focused tests and verify red**

Run:

```powershell
npx vitest run lib/registry-data-adapters.test.tsx lib/core-sections.test.ts lib/capstone-components.test.ts lib/dossier.test.ts
```

Expected: FAIL because the registry adapters and replacement markup do not exist.

- [ ] **Step 3: Fetch and extract the registry data components**

Run:

```powershell
curl.exe -fsSL https://chanhdai.com/r/github-contributions.json -o registry-stage/github-contributions.json
node extract-registry.mjs ./registry-stage . work-experience contribution-graph github-contributions
```

Delete the extracted cache/fetch helper and correct all `@/registry` imports.

- [ ] **Step 4: Implement the static adapters and replacements**

Adapt WorkExperience to dossier tokens and prose periods without adding optional npm dependencies. Compose CopyDisclosure for summaries. Adapt ContributionGraph and GitHubContributions to native UTC date helpers, direct snapshot activities, dossier heat colors, and keyboard-labelled SVG groups. Replace the old section in Home, then delete the superseded custom heatmap renderer, enhancement, bucket helper, old CSS, and source-specific tests.

- [ ] **Step 5: Run focused and related tests and verify green**

Run:

```powershell
npx vitest run lib/registry-data-adapters.test.tsx lib/core-sections.test.ts lib/capstone-components.test.ts lib/dossier.test.ts lib/dossier-visual-direction.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

Stage only Task 3 files and commit with subject `feat(experience): adopt registry data displays` using the required author and trailer.

---

### Task 4: Section navigation, brand carousel, testimonials, docs, and gates

**Files:**
- Create: `components/registry/line-nav.tsx`
- Create: `components/registry/logos-carousel.tsx`
- Create: `components/registry/testimonial.tsx`
- Create: `components/registry/testimonials-marquee.tsx`
- Create: `components/section-line-nav.tsx`
- Create: `components/sections/brand-icons.tsx`
- Create: `components/sections/testimonials.tsx`
- Create: `content/testimonials.json`
- Create: `lib/registry-final-sections.test.tsx`
- Modify: `components/sections/brands-wall.tsx`
- Modify: `components/sections/faq.tsx`
- Modify: `components/sections/contact.tsx`
- Modify: `app/page.tsx`
- Modify: `lib/core-sections.test.ts`
- Modify: `lib/final-sections.test.ts`
- Modify: `lib/dossier-visual-direction.test.ts`
- Modify: `scripts/verify-build.mjs`
- Modify: `scripts/verify-build.test.mjs`
- Modify: `scripts/perf-gate.mjs`
- Modify: `scripts/perf-gate.test.mjs`
- Modify: `styles/globals.css`
- Modify: `docs/components-map.md`

**Interfaces:**
- Ordered section IDs are exactly `identity`, `intro`, `contributions`, `insights`, `capabilities`, `stack`, `work`, `timeline`, `education`, `proof`, `products`, `brands`, `testimonials`, `faq`, `contact`.
- Figure labels are consecutive from Fig. 1 through Fig. 15, with Testimonials at 13, FAQ at 14, and Contact at 15.
- `SectionLineNav` is fixed at the left edge, hidden below `xl`, contains all 15 anchors, observes active sections, sets `aria-current`, and remains keyboard accessible.
- `BrandIcon` contains one currentColor SVG per brand using commit-pinned Simple Icons path data. Names and the existing disclaimer remain visible.
- The brand carousel preserves all 10 brands in static markup and stops travel under reduced motion.
- The below-fold carousel is split with `next/dynamic` while its meaningful brand content remains in the static export.
- Testimonials use only the two attributable quotes verified at `https://citadel.zurielst.com`: Tan Hock Guan, Retired Senior Lecturer, Ngee Ann Polytechnic; and Velicia Seraphine, Research Associate, Crafthealth. The commented placeholder for Andrew Palmer is excluded.
- TestimonialsMarquee renders one semantic copy of each testimonial, hides duplicate marquee copies from assistive technology, pauses on interaction, and becomes a static grid under reduced motion.
- The performance cap is exactly `200000`; the Lighthouse threshold stays exactly `0.9`.

- [ ] **Step 1: Add failing section, logo, testimonial, and gate assertions**

Update the ordered section and figure arrays to the exact 15-item contract. Add tests for all line-nav hrefs and active semantics, 10 one-per-brand currentColor SVGs, all brand names, the disclaimer, the two exact real quote attributions, exclusion of the placeholder, testimonial placement before FAQ, and reduced-motion marquee CSS. Add source tests requiring the `200000` cap and unchanged `0.9` Lighthouse minimum.

- [ ] **Step 2: Run focused tests and verify red**

Run:

```powershell
npx vitest run lib/registry-final-sections.test.tsx lib/core-sections.test.ts lib/final-sections.test.ts lib/dossier-visual-direction.test.ts
node --test scripts/perf-gate.test.mjs scripts/verify-build.test.mjs
```

Expected: FAIL because the new section, navigation, logos, and cap are absent.

- [ ] **Step 3: Extract the final registry components**

Run:

```powershell
node extract-registry.mjs ./registry-stage . line-nav logos-carousel testimonial testimonials-marquee
```

The metadata-only testimonials-marquee item writes no file, so create its local composition adapter with the registry provenance header and document that divergence.

- [ ] **Step 4: Implement final sections and gates**

Add SectionLineNav, the exact brand icon map, the adapted LogosCarousel, the verified testimonial data and marquee section, and the new Home order. Renumber FAQ and Contact, update the build verifier, replace old Brands tests that prohibited SVGs, integrate reduced-motion and focus CSS, raise the JavaScript cap with the required registry-adoption comment, and finish `docs/components-map.md` with sources and all divergences.

- [ ] **Step 5: Run focused and full pre-commit verification**

Run:

```powershell
npx vitest run lib/registry-final-sections.test.tsx lib/core-sections.test.ts lib/final-sections.test.ts lib/dossier-visual-direction.test.ts
node --test scripts/perf-gate.test.mjs scripts/verify-build.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

Stage only Task 4 files and commit with subject `feat(navigation): complete registry section adoption` using the required author and trailer. Include the two live Citadel testimonial attributions and Simple Icons provenance in the commit body.

---

### Task 5: Final verification, review, and handoff

**Files:**
- Inspect all tracked changes against `TASK-REGISTRY.md`.
- Do not add a new commit unless verification fixes require one; amend the owning logical commit where safe, otherwise create one final fix commit without exceeding six total commits.

**Interfaces:**
- The final export contains exactly 15 ordered sections and consecutive figure labels.
- No tracked or exported file contains an em dash.
- No forbidden task, log, review, staging, or extractor file is committed.
- All commits have the required author and trailer.
- No remote push occurs.

- [ ] **Step 1: Run the exact verification loop with real exit codes**

Run each command separately:

```powershell
npm run typecheck
npx vitest run
npm run build
npm run perf
```

Expected: all four commands exit 0. Confirm the Lighthouse median is at least `0.90` and Brotli JavaScript is no more than `200000` bytes.

- [ ] **Step 2: Run export and repository audits**

Check the built `out/index.html` for the 15 ordered IDs, consecutive figure labels, real testimonials, one brand SVG per brand, honesty captions, reduced-motion hooks, and absence of em dashes. Check `git diff --check`, tracked file names, commit authors, trailers, count, and prohibited paths.

- [ ] **Step 3: Perform task and whole-branch reviews**

Review every logical task diff for specification compliance and code quality. Then review the complete branch against `origin/main`, fix every Critical or Important finding with a focused test, and rerun the affected gate.

- [ ] **Step 4: Leave the branch ready without pushing**

Confirm the final branch is `tri/26-registry`, the commit count is between 3 and 6, and only the user's pre-existing tracked changes plus excluded untracked artifacts remain outside the committed branch diff.

The final user-facing response must end with the exact line `REGISTRY_CODEX_DONE`.
