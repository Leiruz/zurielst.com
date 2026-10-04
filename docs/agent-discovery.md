# Public portfolio discovery

The homepage has two public representations. Browsers receive the existing HTML by default. A GET or HEAD request explicitly preferring `text/markdown` receives the existing generated public dossier at the same root URL. Quality values and explicit exclusions in `Accept` take precedence over wildcards. Wildcards alone retain HTML.

The root responses carry `Vary: Accept` and `Cache-Control: no-store`. This deliberately avoids shared caches mixing representations: Cloudflare's general cache does not use arbitrary `Vary` values as cache keys. The assets binding still retrieves HTML and the dossier independently. The handler streams the selected asset, preserves its validator/status, returns no body for HEAD, and applies the exact existing global `_headers` policy. Workers.dev previews remain noindex.

HTTP `Link` headers connect the canonical homepage, Markdown alternate (`/dossier.md`), and descriptive guide (`/llms.txt`). Direct dossier responses use `text/markdown; charset=utf-8`. Only the root runs the Worker before static assets; other assets retain the existing routing. The Worker has only the static assets binding, with no secrets, storage, authentication, or external fetches. Both site configs include the same handler; existing production routes and protected deployment approvals remain in place.

The agent-readiness scanner is an emerging discovery checklist, not a compliance certification. This portfolio does not expose a general agent API, OAuth identity provider, MCP service, WebMCP tools, agent skills, or commerce capabilities. We do not declare unsupported capabilities or speculative manifests to satisfy a score.

Robots crawl rules and AI-training/content rights are unchanged. Content Signals would express an owner's rights policy and require an explicit choice. DNS-AID is a separate DNS decision, not necessary to read this public portfolio. Existing biography data and dossier content remain unchanged.

Validation: `node --test scripts/site-discovery.test.mjs`, `npm run typecheck`, `npm test`, `npm run build`, and `npx wrangler deploy --config workers/site/wrangler.jsonc --dry-run`. Check the actual Worker with alternating HTML/Markdown GET and HEAD requests, security headers, direct exports, and 404s before deployment. PR CI also bundles the Worker without deploying.

References: [HTTP Accept](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.1), [HTTP links](https://www.rfc-editor.org/rfc/rfc8288.html), [selective Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/).
