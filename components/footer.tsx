'use client';

import type { MouseEvent } from 'react';

export const TERMINAL_OPEN_EVENT = 'dossier:terminal-open';

interface FooterProps {
  name: string;
}

export function Footer({ name }: FooterProps) {
  function openTerminal(event: MouseEvent<HTMLButtonElement>) {
    window.dispatchEvent(
      new CustomEvent(TERMINAL_OPEN_EVENT, { detail: event.currentTarget }),
    );
  }

  return (
    <footer className="border-t border-line bg-canvas py-8">
      <div className="dossier-shell space-y-2 font-mono text-xs text-text-3">
        <p>© {new Date().getFullYear()} {name}. <button type="button" onClick={openTerminal} className="rounded-sm underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-1">zurielst.com</button></p>
        <p>Built with components from <a href="https://chanhdai.com" target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-1">ncdai&apos;s registry (MIT)</a></p>
        <p><a href="https://github.com/Leiruz/zurielst.com" target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-1">View source</a></p>
      </div>
    </footer>
  );
}
