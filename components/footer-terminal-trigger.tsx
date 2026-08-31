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
      className="rounded-sm underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-1"
    >
      zurielst.com
    </button>
  );
}
