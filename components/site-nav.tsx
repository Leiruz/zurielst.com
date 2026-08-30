import { DeferredThemeSwitcher } from '@/components/registry/client-enhancements';

const LINKS = [
  ['Stack', '#stack'],
  ['Work', '#work'],
  ['Timeline', '#timeline'],
  ['Education', '#education'],
  ['Accolades', '#proof'],
  ['Products', '#products'],
  ['FAQ', '#faq'],
  ['Contact', '#contact'],
] as const;

interface SiteNavTarget {
  closest?(selector: string): SiteNavTarget | null;
  removeAttribute?(name: string): void;
}

interface SiteNavRoot {
  addEventListener(
    type: 'click',
    listener: (event: { target: SiteNavTarget | null }) => void,
  ): void;
}

interface SiteNavRuntime {
  __dossierPendingOpenRequests?: Array<{ detail: unknown; eventType: string }>;
  CustomEvent: new (type: string, init?: { detail?: unknown }) => Event;
  dispatchEvent(event: Event): boolean | void;
}

export function enhanceSiteNav(
  nav: SiteNavRoot | null,
  runtime: SiteNavRuntime,
) {
  if (!nav) return;

  nav.addEventListener('click', (event) => {
    const target = event.target;
    if (typeof target?.closest !== 'function') return;

    const terminalTrigger = target.closest('[data-terminal-trigger]');
    if (terminalTrigger) {
      (runtime.__dossierPendingOpenRequests ??= []).push({
        detail: terminalTrigger,
        eventType: 'dossier:terminal-open',
      });
      runtime.dispatchEvent(
        new runtime.CustomEvent('dossier:terminal-open', {
          detail: terminalTrigger,
        }),
      );
    }

    const paletteTrigger = target.closest('[data-command-palette-trigger]');
    if (paletteTrigger) {
      (runtime.__dossierPendingOpenRequests ??= []).push({
        detail: paletteTrigger,
        eventType: 'dossier:command-palette-open',
      });
      runtime.dispatchEvent(
        new runtime.CustomEvent('dossier:command-palette-open', {
          detail: paletteTrigger,
        }),
      );
    }

    target
      .closest('[data-mobile-nav-link]')
      ?.closest?.('details')
      ?.removeAttribute?.('open');
  });
}

const SITE_NAV_ENHANCEMENT_SCRIPT = `(${enhanceSiteNav.toString()})(document.currentScript?.closest("nav") ?? null, window);`;

export function SiteNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur-sm" aria-label="Primary navigation">
      <div className="dossier-shell flex min-h-14 items-center gap-3">
        <button
          type="button"
          aria-label="Open terminal"
          data-terminal-trigger="true"
          className="group inline-flex size-11 shrink-0 items-center justify-center rounded-sm font-mono text-text-1 transition-colors duration-150 hover:text-ring motion-reduce:transition-none"
        >
          <span aria-hidden="true" className="text-sm font-semibold tracking-[0.16em]">ZST</span>
        </button>

        <div className="ml-auto hidden items-center gap-5 lg:flex">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href} className="font-mono text-xs text-text-2 transition-colors duration-150 hover:text-text-1">
              {label}
            </a>
          ))}
        </div>

        <details className="group relative ml-auto lg:hidden">
          <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-line bg-surface text-text-1 transition-colors duration-150 hover:bg-surface-hover marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="sr-only">Toggle navigation menu</span>
            <span aria-hidden="true" className="grid gap-1">
              <span className="block h-px w-4 bg-current" />
              <span className="block h-px w-4 bg-current" />
              <span className="block h-px w-4 bg-current" />
            </span>
          </summary>
          <div className="absolute right-0 top-[calc(100%+0.5rem)] w-48 rounded-lg border border-line bg-surface p-2 shadow-xl">
            {LINKS.map(([label, href]) => (
              <a key={href} href={href} data-mobile-nav-link="true" className="block rounded-md px-3 py-2 font-mono text-sm text-text-2 transition-colors duration-150 hover:bg-surface-hover hover:text-text-1">
                {label}
              </a>
            ))}
          </div>
        </details>

        <button
          type="button"
          aria-label="Open command palette"
          data-command-palette-trigger="true"
          className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-2.5 font-mono text-[0.65rem] text-text-2 transition-colors duration-150 hover:bg-surface-hover hover:text-text-1 motion-reduce:transition-none"
        >
          <span aria-hidden="true" className="inline-flex items-center gap-1">
            <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line bg-canvas-raised px-1 font-mono text-[0.65rem] text-text-3">Ctrl</kbd>
            <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line bg-canvas-raised px-1 font-mono text-[0.65rem] text-text-3">K</kbd>
          </span>
        </button>
        <DeferredThemeSwitcher />
      </div>
      <script
        id="site-nav-enhancement"
        dangerouslySetInnerHTML={{ __html: SITE_NAV_ENHANCEMENT_SCRIPT }}
      />
    </nav>
  );
}
