'use client';

import type { MouseEvent } from 'react';

import {
  requestPrivacyChoicesOpen,
  type PrivacyChoicesOpenTarget,
} from '@/lib/privacy-choices';

export function FooterPrivacyChoices() {
  function openPrivacyChoices(event: MouseEvent<HTMLButtonElement>) {
    requestPrivacyChoicesOpen(
      window as unknown as PrivacyChoicesOpenTarget,
      event.currentTarget,
    );
  }

  return (
    <button
      type="button"
      onClick={openPrivacyChoices}
      data-footer-privacy-choices="true"
      className="rounded-sm font-mono text-xs text-text-2 transition-colors duration-150 hover:text-text-1 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      Privacy choices
    </button>
  );
}
