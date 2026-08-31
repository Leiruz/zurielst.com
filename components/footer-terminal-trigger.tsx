'use client';

import type { MouseEvent } from 'react';

import { TERMINAL_OPEN_EVENT } from '@/lib/terminal-events';

export function FooterTerminalTrigger() {
  function openTerminal(event: MouseEvent<HTMLButtonElement>) {
    window.dispatchEvent(
      new CustomEvent(TERMINAL_OPEN_EVENT, { detail: event.currentTarget }),
    );
  }

  return (
    <button
      type="button"
      onClick={openTerminal}
      data-haptic
      data-footer-mark
      aria-label="ZST. Open terminal"
      className="rounded-sm font-semibold tracking-[0.16em] text-text-1 transition-colors duration-150 hover:text-ring motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      ZST
    </button>
  );
}
