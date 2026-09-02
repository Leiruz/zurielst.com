# Gradient Bookend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the deferred, pointer-reactive Zuriel gradient wordmark as a large page-bottom bookend immediately above the colophon.

**Architecture:** Mount the existing `DeferredFooterIdentityEffect` as the first child of the footer's shared `dossier-shell`. Keep `FluidGradientText` behind the existing `next/dynamic` boundary and a one-shot IntersectionObserver, give the wrapper a static fallback plus a bounded display height, and extend the browser layout gate to compare the hydrated wordmark with both the fixed rail and the following colophon.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, Tailwind CSS, Vitest, Node test runner, Puppeteer, Lighthouse.

## Global Constraints

- Do not touch consent, analytics, client-enhancement, or intro-greeting files.
- Keep the fluid-gradient implementation vendored and dynamically imported.
- Preserve the existing reduced-motion behavior and `aria-label="Zuriel"`.
- Keep the wordmark inside the dossier shell so it clears the desktop line-nav rail.
- Do not use em dashes in copy or documentation.
- Leave the completed branch local for the operator to push.

---

### Task 1: Prove the page-level mount is missing

**Files:**
- Modify: `lib/registry-identity-motion.test.tsx`

**Interfaces:**
- Consumes: `Home(): JSX.Element` and the existing `data-colophon="true"` marker.
- Produces: A regression test requiring `data-footer-identity-effect="true"` before the colophon in composed page markup.

- [x] **Step 1: Write the failing page-level test**

Add a test that renders `Home`, locates the footer identity marker and colophon marker, asserts both exist, asserts the identity marker precedes the colophon, and asserts the bookend markup includes `Zuriel`.

- [x] **Step 2: Run the focused test and verify the expected failure**

Run: `npx vitest run lib/registry-identity-motion.test.tsx`

Expected: FAIL because `data-footer-identity-effect="true"` is absent from the composed page.

### Task 2: Restore the deferred footer bookend

**Files:**
- Modify: `components/registry/deferred-registry-effects.tsx`
- Modify: `components/footer.tsx`
- Modify: `docs/components-map.md`

**Interfaces:**
- Consumes: `DeferredFluidGradientText`, `Footer`, and `.dossier-shell`.
- Produces: `DeferredFooterIdentityEffect()` with a stable page-level marker and a large bounded region mounted before `[data-colophon="true"]`.

- [x] **Step 1: Give the deferred wrapper its bookend element**

Return a `data-footer-identity-effect="true"` container with `mb-10 h-[clamp(5rem,14vw,10rem)] overflow-hidden`. Keep a centered static Zuriel fallback until a one-shot IntersectionObserver with `rootMargin: '256px 0px'` activates `<DeferredFluidGradientText text="Zuriel" />`.

- [x] **Step 2: Mount the wrapper before the colophon**

Import `DeferredFooterIdentityEffect` into `components/footer.tsx` and render it as the first child of the footer's `.dossier-shell`, immediately before `[data-colophon="true"]`.

- [x] **Step 3: Correct the adoption note**

Replace the stale statement that the gradient is unmounted with a note that it is dynamically loaded as the large footer bookend, retains its accessible label and reduced-motion state, and sits above the colophon.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `npx vitest run lib/registry-identity-motion.test.tsx`

Expected: PASS with the composed-page regression and existing component-isolation tests green.

### Task 3: Gate footer geometry and eager-bundle isolation

**Files:**
- Modify: `scripts/layout-gate.mjs`

**Interfaces:**
- Consumes: `[data-footer-identity-effect="true"]`, `[data-slot="fluid-gradient-text"]`, `[data-colophon="true"]`, and `[data-section-line-nav="true"]`.
- Produces: Desktop measurements for render presence, page order, aligned shell edges, and zero fixed-rail intersection.

- [x] **Step 1: Extend browser measurements**

Require the wordmark wrapper, hydrated gradient slot, and colophon. Record the wrapper and colophon horizontal edges, verify document order, and include the wordmark wrapper in the targets scrolled against the fixed rail.

- [x] **Step 2: Extend desktop assertions**

Assert the gradient slot rendered, the wrapper precedes the colophon, their left and right edges align, and the wrapper never intersects the line-nav rail.

- [x] **Step 3: Run the focused automated suites**

Run: `npx vitest run lib/registry-identity-motion.test.tsx lib/registry-final-sections.test.tsx`

Expected: PASS.

### Task 4: Complete every delivery gate

**Files:**
- Verify only: generated `out/` assets and Git state.

**Interfaces:**
- Consumes: The completed implementation and repository scripts.
- Produces: Fresh evidence for tests, static export, JavaScript budget, layout, Chromium rendering, bundle separation, and the local commit.

- [ ] **Step 1: Run both requested test gates**

Run: `npx vitest run`

Run: `npm test`

Expected: Both commands exit 0 with zero failures.

- [x] **Step 2: Build the static export**

Run: `npm run build`

Expected: Exit 0 and a verified `out/index.html`.

- [ ] **Step 3: Run performance and layout gates**

Run: `node scripts/perf-gate.mjs`

Run: `npm run layout:gate`

Expected: Both exit 0. Record the reported Brotli JavaScript byte count.

- [x] **Step 4: Inspect Chromium and the emitted bundle graph**

At 1280px and 1920px, verify the hydrated gradient is visible above the colophon and has no fixed-rail intersection. Starting from the scripts referenced by `out/index.html`, traverse static chunk imports and assert that the chunk containing `fluid-gradient-text` or its Motion implementation is not in that eager graph.

- [ ] **Step 5: Review and commit**

Inspect `git diff`, confirm no protected lane files changed, stage only task files, commit on `tri/42-gradient`, and confirm the worktree has no task-owned uncommitted changes.
