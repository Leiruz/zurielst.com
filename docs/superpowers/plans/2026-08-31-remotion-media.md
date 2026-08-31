# M9 Remotion Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development when tasks are independent, or executing-plans when working through the shared render pipeline inline. Steps use checkbox syntax for tracking.

**Goal:** Add a reproducible Remotion project, commit three budgeted static media outputs, and atomically publish the OG and Twitter image metadata.

**Architecture:** A development-only Remotion entry registers one still and two deterministic video compositions. An npm script renders directly into `public/`; the site consumes only `/og.png`, while both ambient loops remain unwired because the optional playback contract cannot be guaranteed without LCP or runtime-JavaScript risk.

**Tech Stack:** TypeScript, React 19, Remotion 4.0.518, Node test runner, Vitest, Next.js metadata, H.264 MP4.

## Global Constraints

- Work on `tri/25-media`, based on `origin/main`.
- Commit author: `Zuriel Shanley Tanyory <zurielst@u.nus.edu>`.
- Every commit includes `Co-Authored-By: Codex <codex@openai.com>`.
- Do not push.
- Do not commit `TASK-M9.md`, `TASK-M8.md`, `TASK-M8-FIX.md`, or `codex-m8.log`.
- Do not add em dashes to copy or docs.
- Pin `remotion` and `@remotion/cli` exactly at the same version under `devDependencies`.
- Regenerate `package-lock.json` with npm 10.9.0.
- Keep `public/og.png` at or below 300 KB, `hero.mp4` at or below 1.5 MB, `card.mp4` at or below 800 KB, and total committed video at or below 8 MB.
- Keep Remotion out of site runtime imports and keep the video loops unwired.
- Finish in three logical commits: process docs, rendered media pipeline, and atomic social metadata.

---

### Task 1: Reproducible Remotion media pipeline

**Files:**

- Create: `scripts/media-assets.test.mjs`
- Create: `remotion/src/index.tsx`
- Create: `remotion/src/root.tsx`
- Create: `remotion/src/design.tsx`
- Create: `remotion/src/og-card.tsx`
- Create: `remotion/src/hero-loop.tsx`
- Create: `remotion/src/card-loop.tsx`
- Create: `remotion/render.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `public/og.png`
- Create: `public/media/loops/hero.mp4`
- Create: `public/media/loops/card.mp4`

**Interfaces:**

- Produces Remotion IDs `og-card`, `hero-loop`, and `card-loop`.
- Produces the npm command `media:render` and the three exact public output paths.
- Does not expose a React import from `remotion` to the Next.js application.

- [ ] **Step 1: Write the failing media contract**

  Add a Node test that reads `package.json`, `remotion/render.mjs`, the Remotion root source, and the expected public outputs. Assert exact pinned dependencies, all three render invocations, composition IDs, dimensions, durations, PNG signature and IHDR dimensions, MP4 `ftyp` and `avc1` markers, and all four byte budgets.

- [ ] **Step 2: Run the red test**

  Run: `node --test scripts/media-assets.test.mjs`

  Expected: fail because the render script, Remotion sources, and public outputs do not exist.

- [ ] **Step 3: Install the exact development tools**

  Run: `npx npm@10.9.0 install --save-dev --save-exact remotion@4.0.518 @remotion/cli@4.0.518`

  Confirm both entries are exact in `package.json` and the lockfile records the same version.

- [ ] **Step 4: Implement the compositions and render script**

  Register a 1200 by 630 `Still`, a 640 by 360 7-second composition at 30 fps, and a 640 by 360 6-second composition at 30 fps. Use frame-derived periodic grid, scan, radar, and signal movement with no CSS animation. Add `media:render` calling a cross-platform Node script that invokes one still command and two H.264 render commands using `yuv420p`, fixed bitrates, and BT.709 color.

- [ ] **Step 5: Inspect representative frames**

  Render the OG still and representative hero and card frames. Inspect them at full size for hierarchy, contrast, overlap, safe areas, and single-accent compliance. Correct the source and repeat until all three are clean.

- [ ] **Step 6: Render final assets and run the green test**

  Run: `npm run media:render`

  Run: `node --test scripts/media-assets.test.mjs`

  Expected: all media contract tests pass and every asset is within budget.

- [ ] **Step 7: Commit the media pipeline and outputs**

  Commit the source, exact dependencies, lockfile, media test, and three outputs. Record individual and total sizes in the body. State that the loops remain unwired because true lazy autoplay, reduced-motion swapping, no LCP impact, and unchanged runtime JavaScript cannot all be guaranteed cleanly.

### Task 2: Atomic social image metadata

**Files:**

- Modify: `scripts/seo-metadata.test.mjs`
- Modify: `content/profile.test.ts`
- Modify: `content/schema.ts`
- Modify: `content/profile.json`
- Modify: `app/layout.tsx`
- Modify: `docs/m1-notes.md`

**Interfaces:**

- Consumes the committed `public/og.png` asset from Task 1.
- Produces Open Graph profile metadata and Twitter large-card metadata for `/og.png`.

- [ ] **Step 1: Update the tests first**

  Require `/og.png`, Open Graph width `1200`, height `630`, alt text, retained `profile` type, Twitter `summary_large_image`, Twitter image data, and an updated atomic-shipping comment. Require the profile source to use `/og.png`.

- [ ] **Step 2: Run the red tests**

  Run: `node --test scripts/seo-metadata.test.mjs`

  Run: `npx vitest run content/profile.test.ts`

  Expected: fail on the old summary card, missing image metadata, stale comment, and stale profile path.

- [ ] **Step 3: Implement the metadata contract**

  Narrow the profile OG image schema to `/og.png`, update the JSON path and M1 note, create one shared image descriptor in `app/layout.tsx`, add it to Open Graph and Twitter metadata, change the Twitter card, and update the comment to describe the completed atomic landing.

- [ ] **Step 4: Run focused green tests**

  Run: `node --test scripts/seo-metadata.test.mjs scripts/media-assets.test.mjs`

  Run: `npx vitest run content/profile.test.ts`

  Expected: all focused tests pass.

- [ ] **Step 5: Run the complete verification loop**

  Run each command separately and require exit code 0:

  ```text
  npm run typecheck
  npx vitest run
  npm test
  npm run build
  npm run perf
  npx npm@10.9.0 ci --dry-run
  ```

  Inspect the exported HTML for `og:image`, image dimensions and alt, `twitter:card`, and `twitter:image`. Recheck actual media sizes and H.264 markers.

- [ ] **Step 6: Commit the atomic metadata change**

  Commit the test, profile, schema, note, and layout changes with the required author and trailer. Include all verification exit codes and final media sizes in the body.
