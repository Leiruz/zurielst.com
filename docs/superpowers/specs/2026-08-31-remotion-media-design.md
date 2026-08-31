# M9 Remotion Media Design

## Status

`TASK-M9.md` is the owner-approved brief for this work. It fixes the deliverables, paths, dimensions, duration ranges, budgets, metadata behavior, and motion constraints. This design records the implementation choices needed to execute that brief without reopening its scope.

## Outcome

The repository will gain a small Remotion project that produces one social-sharing still and two ambient H.264 loops. All three outputs are rendered during development and committed as static public assets. Remotion remains a development-only tool, so the exported site gains no runtime dependency or JavaScript.

## Visual system

All compositions use the dark dossier palette from the site: `#09090a` canvas, restrained white and grey hairlines, near-white primary copy, and `#4b7bff` as the only accent. Typography uses Geist-family system fallbacks. Blueprint grids, crop marks, fine rules, and the compact ZST line mark carry the existing identity without restoring the large hero backdrop removed in earlier design work.

The OG card has one focal point: Zuriel Shanley Tanyory's name. It also includes the small ZST mark, `AI. CYBER. DEFENCE.` in tracked mono type, the exact profile tagline, and a thin blueprint motif. The loops contain no dense interface copy. Their motion is low contrast, mathematically periodic, and driven only by Remotion frames.

## Composition architecture

`remotion/src/index.tsx` registers the Remotion root. `remotion/src/root.tsx` declares the 1200 by 630 still and two 640 by 360 video compositions. Shared palette, typography, line-mark, grid, and frame helpers live in `remotion/src/design.tsx`. Each composition owns its scene-specific layout and motion.

The npm `media:render` script calls `remotion/render.mjs`, which invokes one `npx remotion still` command followed by one `npx remotion render` command for each loop and rejects any over-budget output. The two videos use H.264, `yuv420p`, and fixed bitrates chosen to preserve crisp flat geometry while staying below the budgets. The committed outputs are:

| Composition | Duration | Output | Budget |
| --- | ---: | --- | ---: |
| `og-card` | Still | `public/og.png` | 300 KB |
| `hero-loop` | 7 seconds | `public/media/loops/hero.mp4` | 1.5 MB |
| `card-loop` | 6 seconds | `public/media/loops/card.mp4` | 800 KB |

The total video budget remains 8 MB, although the two individual limits are stricter.

## Metadata integration

The profile source of truth changes its stale OG path from `/media/og-card.png` to `/og.png`, with the schema narrowed to that exact public asset. `app/layout.tsx` publishes `/og.png` for Open Graph with width, height, and alt text, keeps `og:type` as `profile`, and publishes a `summary_large_image` Twitter card with the same image. The pending atomic-landing comment becomes a statement that the metadata and asset ship together.

## Playback decision

The loops will remain unwired. The current hero contains an eager, high-priority portrait. Native above-fold autoplay begins fetching and is not honest lazy loading, while a source swap driven by intersection and reduced-motion preferences would add runtime JavaScript. That means the task's no-LCP-harm, true-lazy, reduced-motion, and unchanged-JavaScript conditions cannot all be guaranteed cleanly. Shipping the assets without placement follows the brief's honesty clause and leaves placement to the owner.

## Verification

Tests will cover composition registrations, render paths and flags, file signatures and dimensions, H.264 markers, durations declared by the compositions, individual size ceilings, the total video ceiling, profile schema consistency, and the complete OG and Twitter metadata contract. Representative frames will be inspected at full size before final rendering. The final gate runs every command required by `TASK-M9.md`, plus the repository's complete `npm test` command so the new Node contract tests execute.
