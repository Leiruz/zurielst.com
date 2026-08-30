# Owner Parity Design

## Scope

Implement the six visible parity requests in `TASK-PARITY.md` without new dependencies or changes to `content/`, `workers/`, or `.github/`. Preserve the server-rendered dossier and defer the command palette until a visitor explicitly opens it.

## Chosen architecture

The intro cover and hydrated intro share one exported sizing class so their takeover is visually identical. The identity section remains a server component, with only the portrait failure behavior isolated in a small client avatar. The avatar renders both the image path and monogram fallback in its initial markup, then switches visibility after an image error.

Education becomes a focused server section between Timeline and Proof wall. Timeline filters education records without changing profile data. Figure labels remain literal and consecutive so static HTML, assistive technology, and export verification agree. The Contact change is limited to the figure label literal required for Fig. 10.

The command palette uses two client boundaries. A small always-loaded loader listens for Ctrl+K, Cmd+K, and the SiteNav open event. It imports the full palette only after one of those interactions. The fixed dialog is rendered beside the existing terminal, outside the sticky navigation stacking context. It receives only the public email and link values it needs.

## Alternatives considered

1. A module-level `next/dynamic` palette inside SiteNav was simpler, but Next could preload its chunk before interaction.
2. A vanilla DOM dialog would keep the loader small, but it would duplicate the React focus and theme patterns already used by the terminal and theme switcher.
3. The selected event-driven loader keeps the initial client boundary small while giving the dialog a normal React state model and a directly testable action layer.

## Interaction and accessibility

The palette exposes a labelled modal dialog, search input, listbox, grouped option roles, and `aria-activedescendant`. Filtering is a case-insensitive substring match across labels and keywords. Arrow keys wrap selection, Enter activates the selected action, Escape closes, Tab stays inside the dialog, and focus returns to the opener. Section navigation uses instant scrolling for reduced motion. Theme toggle derives the next concrete theme and calls `setTheme` from `next-themes`.

## Verification

Tests cover intro parity, portrait markup and failure fallback, verified-name wrapping, education filtering and order, figure numbering, resume links and export, terminal routing, palette actions, focus, keyboard handling, ARIA, theme switching, and interaction-only loading. Build verification asserts ten ordered section IDs, figure labels 1 through 10, no em dash, and `out/media/resume.pdf`. Final commands run separately: `npm run typecheck`, `npm test`, `npm run build`, and `npm run perf`.
