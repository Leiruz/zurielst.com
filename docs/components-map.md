# Components map

Vendored from ncdai's registry (chanhdai.com/r, MIT license; TRADEMARK.md restricts only chanhdai branding, none of which is vendored here). Each item below was fetched 2026-08-30 and saved byte-exact before extraction; the SHA256 lets any future registry state be diffed against what we shipped. Owner-excluded items (checklist 2026-08-30) are not vendored: not-found-01, login-01, slide-to-unlock, wheel-picker, elastic-slider, brand-assets-menu, code-block-command, blog-01, blog-02.
# Registry stage manifest: chanhdai.com KEEP set

Fetched 2026-08-30 from https://chanhdai.com/r/registry.json (registry name "ncdai", 64 published items).
Every {name}.json in this folder is byte-for-byte as served from https://chanhdai.com/r/{name}.json.
Purpose: staging area so M2 vendoring for the zurielst.com rebuild is a copy job from this folder.
_registry-index.json is the registry index kept for reference; it and this manifest are not part of the vendored payload.

## Mapping notes

- All 36 requested KEEP names matched the live registry verbatim: no renames, none missing.
- blog-01 excluded by instruction (a blog-02 also exists and is likewise excluded: no blog).
- theme-toggle-effect-circle exists and was picked. All published variants: theme-toggle-effect-triangle, theme-toggle-effect-triangle-blur, theme-toggle-effect-circle, theme-toggle-effect-circle-blur, theme-toggle-effect-circle-blur-top-left, theme-toggle-effect-polygon, theme-toggle-effect-polygon-gradient.
- Two internal items were pulled in transitively and are staged here too: chevrons-up-down-icon (via work-experience), testimonial (via testimonial-spotlight and testimonials-marquee).
- Four registryDependencies point at third-party namespaced registries, NOT shadcn base and NOT chanhdai; they are not staged here and need namespace entries in components.json (or manual vendoring from those registries) at M2 time:
  - @bklit/line-chart (needed by metrics-01)
  - @kibo-ui/marquee (needed by testimonials-marquee)
  - @soundcn/metal-click (needed by spotlight-logo)
  - @soundcn/u-mini-map-open (needed by toc-minimap)
- Types as published use registry:component for UI components (not registry:ui), plus registry:block, registry:style, registry:hook.
- File count 0 is real for testimonials-marquee, typography, thin-scrollbar, style, theme-toggle-effect-circle: their payload is css/cssVars/metadata (and for testimonials-marquee, composition via registryDependencies) rather than component files.

## Staged items (39 = 37 requested + 2 transitive)

Bytes = size of the staged registry JSON exactly as fetched (source code is embedded in it). Files = entries in the item's files array.
registryDependencies legend: plain name = shadcn base component (ui.shadcn.com); [internal] = chanhdai item staged in this folder; [3rd-party] = external namespaced registry, not staged.

| Item | Type | Files | Bytes | npm dependencies | registryDependencies | next/* or next-themes imports | SHA256 (saved JSON) |
|---|---|---|---|---|---|---|---|
| apple-hello-effect | registry:component | 1 | 4384 | motion | - | - | `26bd8928ec7c3980f6cc1247c831ab1113a90e346f65fefba5b145f765330cd8` |
| consent-manager | registry:component | 1 | 7857 | @c15t/nextjs | button | @c15t/nextjs | `3a9a7f75ef74165f5f7ab84bc6064ad00645e07fe960db1fd53f22feafdc3f75` |
| theme-switcher | registry:component | 1 | 3413 | next-themes, motion | - | next-themes | `7b5be7bdb0f001a5394d3bb756bb9333a9619b7c6bd238275b0d995fb3d91a6b` |
| contribution-graph | registry:component | 1 | 13354 | date-fns | - | - | `0818fb35e69f56a774613bf5ac72d13727ad7940cea8eeb76e969c140f83a5e0` |
| work-experience | registry:component | 1 | 12181 | react-markdown, date-fns | collapsible, separator, chevrons-up-down-icon [internal], typography [internal] | - | `f4b54dca50fa5482e9c631372bebd2a53b2e715a7c4d9c5d065275e6679ef920` |
| timescale | registry:component | 1 | 9760 | - | - | - | `d70605c6accdd35e229f1dc278b9d98719400beede3c583c75bc30617bba6646` |
| glow-card-grid | registry:component | 1 | 5733 | - | - | - | `697511424edc76ff595359fdf5a32641096b62a102ca54d3fdac6d5d4954ad73` |
| testimonial-spotlight | registry:component | 1 | 2286 | - | testimonial [internal] | - | `f13c5ca3646bb94f7b65a99b5466fcdfe766d18a33da7a5ae13af92fdae744c8` |
| testimonials-marquee | registry:component | 0 | 499 | - | @kibo-ui/marquee [3rd-party], testimonial [internal] | - | `94239ec0a74b6317c3be1eaa8c34d781d88385be9042da1b8cf5972f379bf1bc` |
| logos-carousel | registry:component | 1 | 6290 | motion | - | - | `56321a779cf027389339b51f90108932db6d8224a10c31f71655288afe3aab1f` |
| metrics-01 | registry:block | 2 | 12504 | date-fns | @bklit/line-chart [3rd-party], style [internal] | - | `620b859e074786fbe8bc0aab91d66a312a8caac090b791625e66e436c7e61a7a` |
| text-flip | registry:component | 1 | 3009 | motion | - | - | `58483c6fa826914d310af33b99df5f5c711b9b93f5663c084b2559bc48235e78` |
| shimmering-text | registry:component | 1 | 2673 | motion | - | - | `4893a4a34bb01df9fd9e857cdd426c3dbf76e8dcc214d3742cc374d98169056d` |
| fluid-gradient-text | registry:component | 1 | 3224 | motion | - | - | `341d98d8d33408c398f79d0c18bd943d6cb35f4ddc49692c6486a4d03d59762b` |
| spotlight-logo | registry:component | 1 | 9953 | motion | @soundcn/metal-click [3rd-party] | - | `9c7aecc16a01be0222bc23525b901b50e1d884ef910667ed9bc1818fbf7a3f95` |
| dot-grid-spotlight | registry:component | 1 | 6631 | - | - | - | `8e9189d97d31c2feebb521dbbac41a7cc6711c87d27bcc7c7f1178354943cf92` |
| scroll-fade-effect | registry:component | 1 | 4166 | - | - | - | `6f58faaac39e2058ff3fbe46fa8122a4fcae5800bd2c69731b89b0aca1879f53` |
| line-nav | registry:component | 1 | 4283 | motion | - | next/link | `3c038ee717cc910037fb4e723479cc5dc9f91665a8fc1d9cb649fafd257244ed` |
| toc-minimap | registry:component | 1 | 5139 | - | hover-card, @soundcn/u-mini-map-open [3rd-party] | - | `f9c495049d059c63d975ccbfcd1f8228766167bd8340aea24558024109b8ba07` |
| copy-button | registry:component | 2 | 5835 | motion, @rexa-developer/tiks, web-haptics | button, icon-swap [internal] | - | `7fe369045f23338d92dfed9ea18265223be4b02b03d7e8a7970faca810506085` |
| status-button | registry:component | 1 | 8887 | motion, radix-ui | button | - | `7d17df7db65dd2b16fac518546541f3a04680238860793e3eaae6efc2f5ed647` |
| share-menu | registry:component | 1 | 4995 | - | button, dropdown-menu, sonner | - | `0081ac5d250141df7341759f9db6fc80d4affc94c0a8943808f1d3c233bb64fc` |
| github-stars | registry:component | 1 | 3115 | - | button, tooltip | - | `f9a8f667eaecd0a3952dda89432019dd7443569d7798926ef88d1543f917aa59` |
| middle-truncation | registry:component | 1 | 8235 | - | - | - | `3a753f27dab77307a522bf6d140eb59aad05c98aa798523e3b966d1c5ae6ea14` |
| twemoji | registry:component | 2 | 18868 | - | - | - | `15a1c5dcc34e4418334708e1250e2d57135c064090353f4b60077ce7c185cc36` |
| typography | registry:component | 0 | 1685 | - (dev: @tailwindcss/typography) | - | - | `60a52ab982d4a6fdcdaa7474cde0c70c8edc436d9e9df3477400ad26f891289c` |
| icon-swap | registry:component | 1 | 1469 | motion | - | - | `8a0d3db25482d54a11d65ec96d107ac86e9148b986bbe57dcc6dc33a6494cb55` |
| use-sound | registry:hook | 3 | 6161 | - | - | - | `9d94099d44886903fa6ee9590b11ad093fff7744c4b96f7a21133015f5f9ff87` |
| use-controllable-state | registry:hook | 1 | 4351 | - | - | - | `0bcc3351c14c66dfe81601080221571ca592be031fad3089d8b05257be3baeb8` |
| thin-scrollbar | registry:style | 0 | 592 | - | - | - | `e302fe10538b9c5630e6e6c61d311914c0fed337565b67459ae2da7c9e5608fa` |
| style | registry:style | 0 | 653 | - | - | - | `7cef43aa72ba1f55a812781b35801dc6f2b824df9254ff3eadd255e6e10cc1d7` |
| hero-01 | registry:block | 2 | 19465 | - | button, style [internal] | - | `086dedc78e61be13c75e12f0485969918eb26e57838cdb653c05e70a32000fb5` |
| experience-01 | registry:block | 1 | 3901 | - | style [internal], work-experience [internal] | - | `98f21f652949b05f064f7a62f2010fdf6f19c81bbf408335cb3c4f56f7ddb2ac` |
| social-links-01 | registry:block | 1 | 4288 | - | style [internal] | - | `51e0a6db6bef5e72c3a1b53560aec2a98bd7b59f62e357dc67558cee7f195989` |
| social-proof-01 | registry:block | 1 | 59525 | - | logos-carousel [internal] | - | `1f2eca50a6ed3612fd61c003245d3747d5d6e1c5c67c8700166561f6db947595` |
| team-01 | registry:block | 1 | 2084 | - | glow-card-grid [internal] | - | `5b573b17f94e69c77bffb1e38ae386031aa9ba877f8e7cfd0d196c173632978b` |
| theme-toggle-effect-circle | registry:style | 0 | 1303 | - | - | - | `fc47e41c4b65c09d339b4c6d09cf258574dcce1bdf2e3adeb15ff599d746cdb0` |
| chevrons-up-down-icon (transitive) | registry:component | 1 | 2385 | motion | - | - | `857a7651130d771f9ec0617fb4502fb1ed82d468352d558899ab067e9264b7e0` |
| testimonial (transitive) | registry:component | 1 | 3574 | - | - | - | `e2d6707b2d9ab472de8529c3e506520ec270698dd5ffa2beb25579ca579ddb8d` |

## Adaptation flags (Next.js coupling)

- consent-manager: imports @c15t/nextjs.
- consent-manager: local component overrides registry copy with site-specific measurement-only privacy wording.
- consent-manager: uses c15t's headless provider and state with a site-owned automatic banner, and loads the split c15t dialog only after Customize opens it.
- theme-switcher: imports next-themes.
- apple-hello-effect: replaces the Motion runtime with a native SVG and CSS stroke animation while retaining duration scaling and completion signaling.
- apple-hello-effect: joins its two static class names directly so the automatic intro does not load a class-merging runtime.
- theme-switcher: replaces the Motion runtime with CSS reveal and an action-labelled 44px toggle that shows the active-theme icon, removes the explicit system option while preserving system defaults in the provider, and waits for a resolved active theme before rendering the control.
- theme-switcher: uses hand-drawn inline sun and moon SVG geometry so the landing route does not load an icon-library runtime, and adds a lazy WebAudio direction cue that safely falls back to silence.
- line-nav: imports next/link.
- npm-level: @c15t/nextjs declared by consent-manager.
- npm-level: next-themes declared by theme-switcher.
- shadcn base sonner: its stock wrapper declares next-themes as an npm dependency.
- Everything else staged here has no next/* or next-themes import.

## shadcn base components to install (complete, deduplicated)

7 components, resolved transitively across the whole staged set including internal items, then expanded through the shadcn base graph itself (verified live on 2026-08-30 against ui.shadcn.com item JSONs). None of the directly required base components pulls a further base component.

- button (required by consent-manager, copy-button, github-stars, hero-01, share-menu, status-button; brings npm: @radix-ui/react-slot)
- collapsible (required by work-experience; brings npm: @radix-ui/react-collapsible)
- dropdown-menu (required by share-menu; brings npm: @radix-ui/react-dropdown-menu)
- hover-card (required by toc-minimap; brings npm: @radix-ui/react-hover-card)
- separator (required by work-experience; brings npm: @radix-ui/react-separator)
- sonner (required by share-menu; brings npm: sonner, next-themes)
- tooltip (required by github-stars; brings npm: @radix-ui/react-tooltip)

Install: `npx shadcn@latest add button collapsible dropdown-menu hover-card separator sonner tooltip`

## Complete npm dependency list (declared by staged items, deduplicated)

- @c15t/nextjs (for consent-manager)
- @rexa-developer/tiks (for copy-button)
- date-fns (for contribution-graph, metrics-01, work-experience)
- motion (for apple-hello-effect, chevrons-up-down-icon, copy-button, fluid-gradient-text, icon-swap, line-nav, logos-carousel, shimmering-text, spotlight-logo, status-button, text-flip, theme-switcher)
- next-themes (for theme-switcher)
- radix-ui (for status-button)
- react-markdown (for work-experience)
- web-haptics (for copy-button)
- @tailwindcss/typography (devDependency, for typography)

Supplementary, installed automatically with the shadcn base components above: @radix-ui/react-collapsible, @radix-ui/react-dropdown-menu, @radix-ui/react-hover-card, @radix-ui/react-separator, @radix-ui/react-slot, @radix-ui/react-tooltip, next-themes, sonner.

## Total vendored size

39 staged item JSONs, 278,710 bytes (272.2 KiB). Excludes _registry-index.json (59,470 bytes, reference only) and this manifest.

