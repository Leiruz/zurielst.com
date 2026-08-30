'use client';

import { useRef } from 'react';

import { DeferredThemeSwitcher } from '@/components/registry/client-enhancements';
import { COMMAND_PALETTE_OPEN_EVENT } from '@/components/command-palette-loader';

const LINKS = [
  ['Work', '#work'],
  ['Timeline', '#timeline'],
  ['Education', '#education'],
  ['Proof', '#proof'],
  ['Products', '#products'],
  ['FAQ', '#faq'],
  ['Contact', '#contact'],
] as const;

export function SiteNav() {
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);

  function closeMobileMenu() {
    if (mobileMenuRef.current) mobileMenuRef.current.open = false;
  }

  function openCommandPalette(event: React.MouseEvent<HTMLButtonElement>) {
    window.dispatchEvent(
      new CustomEvent(COMMAND_PALETTE_OPEN_EVENT, { detail: event.currentTarget }),
    );
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur-sm" aria-label="Primary navigation">
      <div className="dossier-shell flex min-h-14 items-center gap-3">
        <a className="fig-label shrink-0 rounded-sm" href="#identity">
          zurielst.com
        </a>

        <div className="ml-auto hidden items-center gap-5 md:flex">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href} className="font-mono text-xs text-text-2 transition-colors duration-150 hover:text-text-1">
              {label}
            </a>
          ))}
        </div>

        <details ref={mobileMenuRef} className="group relative ml-auto md:hidden">
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
              <a key={href} href={href} onClick={closeMobileMenu} className="block rounded-md px-3 py-2 font-mono text-sm text-text-2 transition-colors duration-150 hover:bg-surface-hover hover:text-text-1">
                {label}
              </a>
            ))}
          </div>
        </details>

        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Open command palette"
          className="inline-flex h-8 items-center rounded-full border border-line bg-surface px-2.5 font-mono text-[0.65rem] text-text-2 transition-colors duration-150 hover:bg-surface-hover hover:text-text-1 motion-reduce:transition-none"
        >
          Ctrl K
        </button>
        <DeferredThemeSwitcher />
      </div>
    </nav>
  );
}
