# Slide gate polish TDD evidence

## Source brief

The user journeys and acceptance criteria came from the workspace brief `TASK-POLISH3.md`.

## User journeys

- As a first-session visitor using full motion, I want the landing page to remain gated after the hello animation so that only a completed slide reveals it.
- As a pointer or keyboard user, I want one accessible slide control so that dragging, Enter, Space, or ArrowRight can unlock the page.
- As a visitor, I want the slide label to use the existing shimmer treatment so that the control has the requested iOS-style shine without duplicate effects or dependencies.
- As a reduced-motion visitor, I want to bypass the full intro and slide gate so that I land directly on the static page.
- As a returning visitor in the same session, I want the stored completion flag to bypass the intro.

## Task report

### RED

Command: `npx vitest run components/registry/intro-gate.test.tsx`

Result: exit code 1, with 5 intended failures and 28 passing tests. The failures covered the reduced-motion first-paint bypass, hydrated eligibility guard, shimmering Slide to unlock label, and visible-state scroll lock. The animation-completion test remained green and confirmed that completion revealed the control without dismissing the overlay.

Checkpoint: `53f7f60 test: define slide gate polish contracts`

### GREEN

Command: `npx vitest run components/registry/intro-gate.test.tsx`

Result: exit code 0, with 33 passing tests in 1 file.

Checkpoint: `3151f14 feat: harden slide intro gate`

### Refactor

Command: `npx vitest run components/registry/intro-gate.test.tsx`

Result: exit code 0, with 33 passing tests after removing the unreachable reduced-motion Enter branch. Reduced motion is now handled only by the first-paint and hydration eligibility guards, while the slide handle retains Enter and Space activation.

Checkpoint: `9f2b7c8 refactor: remove bypassed intro entry path`

### Final full gates

- `npx vitest run`: exit code 0, 39 files and 428 tests passed.
- `npm run build`: exit code 0, Next.js compilation and TypeScript passed, 3 static pages exported, and the build verifier checked 3 HTML files, 2 stylesheets, and `out/_headers`.
- `node scripts/perf-gate.mjs`: exit code 0, performance median 0.96 and Brotli JavaScript size 183,610 bytes.

## Test specification

| # | What is guaranteed | Test or command | Type | Result |
|---|---|---|---|---|
| 1 | The slide label is one `ShimmeringText` instance using the shared reduced-motion CSS | `IntroOverlay > waits for the full handwriting animation before fading in one slide label` | component contract | PASS |
| 2 | Handwriting completion reveals the slider but does not dismiss the overlay | `IntroOverlay > reveals the slider on animation completion and dismisses only on unlock` | component behavior | PASS |
| 3 | Pending, active, and leaving intro states lock document scrolling | `IntroOverlay > locks document scrolling for every visible gate state` | CSS contract | PASS |
| 4 | Reduced-motion sessions bypass the first-paint and hydrated gates | `first-paint intro state` reduced-motion and eligibility tests | unit | PASS |
| 5 | Session storage failures fail closed and a seen flag skips the intro | `hasSeenIntro` and first-paint storage tests | unit | PASS |
| 6 | Enter, Space, ArrowRight, dragging, and duplicate-unlock guards remain available | `SlideToUnlockHandle` tests | unit and component contract | PASS |
| 7 | The landing content remains in the static export while the intro stays client-side | `npm run build` and generated `out/index.html` inspection | integration | PASS |

## Coverage and known gaps

The repository does not configure a Vitest coverage command or install a Vitest coverage provider, so no percentage report was available without adding a dependency outside this task. No tests are skipped or disabled in the focused contract. The required full Vitest, build, and performance gates all ran successfully.

## Merge evidence

The branch preserves separate RED, GREEN, and refactor commits. If the commits are later squashed, retain the RED result of 5 intended failures, the focused GREEN and refactor results of 33 passes, and the final full-gate results above in the merge record.
