# Owner Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the six owner parity features with static-export, accessibility, and performance guarantees.

**Architecture:** Keep dossier sections server-rendered, isolate runtime portrait failure handling in a small client child, and load the command palette only after an explicit shortcut or button event. Use pure action and focus helpers so the existing Worker Vitest pool can test interaction behavior without a browser DOM.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript strict, Tailwind CSS 4, next-themes, Vitest Worker pool, Node test runner.

## Global Constraints

- Author every commit as `Zuriel Shanley Tanyory <zurielst@u.nus.edu>`.
- End every commit with `Co-Authored-By: Codex <codex@openai.com>`.
- Create 2 to 4 logical commits, do not push, and do not add npm dependencies.
- Do not commit `TASK-PARITY.md`, `codex-m35.log`, `intro-target.jpg`, `registry-stage/`, or `extract-registry.mjs`.
- Do not change `content/`, `workers/`, or `.github/`.
- Keep `app/page.tsx` edits minimal and additive around the Contact block.
- Do not add em dashes.
- Write and run failing checks before production changes wherever behavior is testable.

---

### Task 1: Intro, portrait, verified name, and resume access

**Files:**
- Modify: `components/registry/intro-gate.test.tsx`
- Modify: `components/registry/intro-first-paint.tsx`
- Modify: `components/registry/intro-gate.tsx`
- Create: `components/sections/portrait-avatar.tsx`
- Create: `lib/identity-header.test.tsx`
- Modify: `components/sections/identity-header.tsx`
- Modify: `components/footer.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `INTRO_HELLO_SIZE_CLASS`, shared by both intro SVGs.
- Produces: `PortraitAvatar({ image, alt, name })`, with image and monogram markup plus runtime `onError` state.
- Produces: identity and footer links to `/media/resume.pdf` with download semantics in identity.

- [ ] **Step 1: Write failing intro and identity tests**

Assert the server and hydrated SVGs both contain `h-auto w-[clamp(200px,32vw,420px)]`. Render IdentityHeader without a filesystem-availability prop and assert the portrait `src`, portrait `alt`, monogram fallback, a `whitespace-nowrap inline-flex` last-name and badge unit, and a download link to `/media/resume.pdf`. Assert Footer contains the resume link.

- [ ] **Step 2: Run the red tests**

Run: `npx vitest run components/registry/intro-gate.test.tsx lib/identity-header.test.tsx`

Expected: failures for the missing shared sizing contract, runtime avatar markup, verified-name wrapper, and resume links.

- [ ] **Step 3: Implement the minimum production changes**

Export the shared intro class from `intro-first-paint.tsx` and consume it in both intro paths. Add the client avatar with initial `failed = false`; render both paths with `hidden={failed}` on the image and `hidden={!failed}` on the monogram; set failed on image error. Split the identity name at the last whitespace boundary and render the final word with the badge in one no-wrap unit. Add the identity dossier resume row and footer resume link. Remove the build-time portrait check and prop from `app/page.tsx`.

- [ ] **Step 4: Run the green tests and inspect the diff**

Run: `npx vitest run components/registry/intro-gate.test.tsx lib/identity-header.test.tsx lib/core-sections.test.ts`

Expected: all selected tests pass.

- [ ] **Step 5: Commit**

Commit message: `feat(identity): add portrait and resume parity`

### Task 2: Education, numbering, navigation, terminal, and export contract

**Files:**
- Create: `components/sections/education.tsx`
- Modify: `components/sections/timeline.tsx`
- Modify: `components/sections/proof-wall.tsx`
- Modify: `components/sections/products.tsx`
- Modify: `components/sections/faq.tsx`
- Modify: `components/sections/contact.tsx` only for the required figure literal
- Modify: `components/site-nav.tsx`
- Modify: `lib/terminal-commands.ts`
- Modify: `app/page.tsx`
- Modify: `lib/core-sections.test.ts`
- Modify: `lib/final-sections.test.ts`
- Modify: `lib/terminal-commands.test.ts`
- Modify: `scripts/verify-build.mjs`
- Modify: `scripts/verify-build.test.mjs`

**Interfaces:**
- Produces: `Education({ profile })`, rendering only education timeline entries in reverse chronological order.
- Produces: ordered section IDs `identity`, `contributions`, `capabilities`, `work`, `timeline`, `education`, `proof`, `products`, `faq`, `contact`.
- Produces: `validateLandingPageContract(html)` and resume-file validation inside `verifyBuildOutput`.

- [ ] **Step 1: Write failing section and export tests**

Assert Timeline excludes education, Education contains NUS then Ngee Ann with org, title, period, and summary, Home orders Timeline before Education before Proof, SiteNav links `#education`, terminal education targets `education`, and figure labels are 1 through 10. Add Node fixtures that reject missing or unordered IDs, incorrect figure numbers, an em dash, and a missing resume PDF.

- [ ] **Step 2: Run the red tests**

Run: `npx vitest run lib/core-sections.test.ts lib/final-sections.test.ts lib/terminal-commands.test.ts`

Run: `node --test scripts/verify-build.test.mjs`

Expected: failures for the missing section, stale terminal target, stale numbering, and missing landing-page export checks.

- [ ] **Step 3: Implement sections and export validation**

Filter `entry.type !== 'education'` in Timeline. In Education, filter education entries and sort by the numeric start year parsed from `period`, descending, then render dossier cards. Insert Education between Timeline and Proof. Add Education to SiteNav and point the terminal command to `education`. Shift Proof, Products, FAQ, and Contact to figures 7, 8, 9, and 10. Validate ordered IDs and `.fig-label` numbers in `out/index.html`, reject `\u2014`, and require `out/media/resume.pdf` to be a file.

- [ ] **Step 4: Run the green tests**

Run: `npx vitest run lib/core-sections.test.ts lib/final-sections.test.ts lib/terminal-commands.test.ts`

Run: `node --test scripts/verify-build.test.mjs`

Expected: all selected tests pass.

- [ ] **Step 5: Commit**

Commit message: `feat(education): add the education journey`

### Task 3: Deferred command palette

**Files:**
- Create: `components/command-palette-loader.tsx`
- Create: `components/command-palette.tsx`
- Create: `lib/command-palette.ts`
- Create: `lib/command-palette.test.tsx`
- Modify: `components/site-nav.tsx`
- Modify: `app/page.tsx`
- Modify: `scripts/perf-gate.test.mjs`

**Interfaces:**
- Produces: `COMMAND_PALETTE_OPEN_EVENT = 'dossier:command-palette-open'`.
- Produces: a loader that imports `@/components/command-palette` only from explicit open handling.
- Produces: 10 Section actions, 4 Action actions, and 3 Link actions.
- Produces: filter, selection, activation, Escape restoration, and Tab trap helpers suitable for mocked tests.

- [ ] **Step 1: Write failing palette tests**

Assert action groups and resume href, case-insensitive label and keyword filtering, arrow wrapping, Enter section navigation through injected scroll and location seams, Escape close plus opener focus restoration, Tab wrapping, copy email, terminal event, and theme `setTheme`. Inspect open dialog markup for a labelled modal dialog, listbox, options, and `aria-activedescendant`. Add a source-level performance test that rejects a static or post-paint palette import.

- [ ] **Step 2: Run the red tests**

Run: `npx vitest run lib/command-palette.test.tsx`

Run: `node --test scripts/perf-gate.test.mjs`

Expected: failures because the palette modules and interaction-only import boundary do not exist.

- [ ] **Step 3: Implement the loader, action model, and dialog**

Dispatch the open event from a small `Ctrl K` SiteNav button next to the theme switcher. The loader captures the opener, listens for Ctrl+K and Cmd+K, and performs `import('@/components/command-palette')` only inside its open function. The dialog uses `useTheme`, filters a flat action list, groups visible options, manages selected index, and activates sections, resume, terminal, theme, clipboard, and external links. Close restores focus unless another dialog action takes ownership.

- [ ] **Step 4: Run the green tests and integration checks**

Run: `npx vitest run lib/command-palette.test.tsx lib/client-boundaries.test.ts`

Run: `node --test scripts/perf-gate.test.mjs`

Expected: all selected tests pass and the palette remains interaction-only.

- [ ] **Step 5: Commit**

Commit message: `feat(navigation): add deferred command palette`

### Task 4: Final verification

**Files:**
- Verify only, except focused fixes required by a failing command.

- [ ] **Step 1: Check scope and forbidden content**

Run `git diff --check`, scan tracked authored files for `\u2014`, confirm forbidden paths are not staged, and confirm no dependency manifest changes.

- [ ] **Step 2: Run required commands separately**

Run in order with independent exit codes:

1. `npm run typecheck`
2. `npm test`
3. `npm run build`
4. `npm run perf`

Expected: every command exits 0. Confirm `out/index.html` has all ten IDs and figures 1 through 10, and `out/media/resume.pdf` exists.

- [ ] **Step 3: Review commits and working tree**

Confirm 2 to 4 new commits, owner authorship, required final trailer, no push, and only expected user-owned dirty files remain.
