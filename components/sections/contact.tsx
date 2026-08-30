'use client';

import { useState } from 'react';
import type { Profile } from '@/content/schema';

interface ContactProps {
  profile: Profile;
}

export function Contact({ profile }: ContactProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const { identity, chat } = profile;

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(identity.email);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <section id="contact" className="dossier-section bg-canvas" aria-labelledby="contact-title">
      <div className="dossier-shell">
        <p className="fig-label">Fig. 9. Contact</p>
        <h2 id="contact-title" className="dossier-title mt-4 text-text-1">The dossier is open.</h2>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a href={`mailto:${identity.email}`} className="break-all font-mono text-base text-text-1 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-2 sm:text-lg">{identity.email}</a>
          <button type="button" onClick={copyEmail} className="rounded-md border border-line-strong bg-surface px-3 py-2 font-mono text-xs text-text-2 transition-colors duration-150 hover:bg-surface-hover hover:text-text-1">Copy email</button>
          <span className="font-mono text-xs text-text-3" role="status" aria-live="polite">
            {copyState === 'copied' ? '✓ Copied' : copyState === 'error' ? 'Copy failed. Select the address instead.' : ''}
          </span>
        </div>

        <div className="mt-6 flex flex-wrap gap-5">
          {identity.socials.map((social) => (
            <a key={social.platform} href={social.url} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-text-2 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-1">{social.platform} ↗</a>
          ))}
        </div>

        <div className="mt-10 flex max-w-3xl flex-wrap items-center gap-3 border-t border-line pt-5">
          <button type="button" disabled className="cursor-not-allowed rounded-full border border-line px-3 py-1 font-mono text-xs text-text-3">Assistant arrives at launch</button>
          <p className="font-mono text-xs leading-5 text-text-3">{chat.disclaimer}</p>
        </div>
      </div>
    </section>
  );
}
