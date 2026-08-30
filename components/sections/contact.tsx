'use client';

import { useRef, useState, type ComponentType } from 'react';
import type { ChatProps } from '@/components/chat/chat';
import type { Social } from '@/content/schema';

type ChatPanelComponent = ComponentType<ChatProps>;
type ChatLoadState = 'idle' | 'loading' | 'ready' | 'error';

interface ChatLoadStatusProps {
  state: ChatLoadState;
  onRetry(): void;
}

export function ChatLoadStatus({ state, onRetry }: ChatLoadStatusProps) {
  if (state === 'loading') {
    return (
      <p className="mt-3 font-mono text-xs text-text-3" role="status">
        Opening assistant...
      </p>
    );
  }
  if (state !== 'error') return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs text-text-3" role="alert">
      <span>The assistant interface could not load.</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-line-strong px-3 py-2 text-text-2 transition-colors duration-150 hover:bg-surface-hover hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Retry
      </button>
    </div>
  );
}

interface ContactProps {
  email: string;
  socials: Social[];
  disclaimer: string;
  intentChips: string[];
}

export function Contact({ email, socials, disclaimer, intentChips }: ContactProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [ChatPanel, setChatPanel] = useState<ChatPanelComponent | null>(null);
  const [chatLoadState, setChatLoadState] = useState<ChatLoadState>('idle');
  const [chatOpen, setChatOpen] = useState(false);
  const chatOpenerRef = useRef<HTMLButtonElement>(null);
  const chatImportRef = useRef<Promise<ChatPanelComponent> | null>(null);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  async function openChat() {
    if (ChatPanel !== null) {
      setChatOpen(true);
      return;
    }

    setChatLoadState('loading');
    try {
      const pendingImport = chatImportRef.current
        ?? import('@/components/chat/chat').then((module) => module.Chat);
      chatImportRef.current = pendingImport;
      const LoadedChatPanel = await pendingImport;
      setChatPanel(() => LoadedChatPanel);
      setChatLoadState('ready');
      setChatOpen(true);
    } catch {
      chatImportRef.current = null;
      setChatOpen(false);
      setChatLoadState('error');
    }
  }

  return (
    <section id="contact" className="dossier-section bg-canvas" aria-labelledby="contact-title">
      <div className="dossier-shell">
        <p className="fig-label">Fig. 10. Contact</p>
        <h2 id="contact-title" className="dossier-title mt-4 text-text-1">The dossier is open.</h2>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a href={`mailto:${email}`} className="break-all font-mono text-base text-text-1 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-2 sm:text-lg">{email}</a>
          <button type="button" onClick={copyEmail} className="rounded-md border border-line-strong bg-surface px-3 py-2 font-mono text-xs text-text-2 transition-colors duration-150 hover:bg-surface-hover hover:text-text-1">Copy email</button>
          <span className="font-mono text-xs text-text-3" role="status" aria-live="polite">
            {copyState === 'copied' ? '✓ Copied' : copyState === 'error' ? 'Copy failed. Select the address instead.' : ''}
          </span>
        </div>

        <div className="mt-6 flex flex-wrap gap-5">
          {socials.map((social) => (
            <a key={social.platform} href={social.url} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-text-2 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-text-1">{social.platform} ↗</a>
          ))}
        </div>

        <div className="mt-10 flex max-w-3xl flex-wrap items-center gap-3 border-t border-line pt-5">
          <button
            ref={chatOpenerRef}
            type="button"
            aria-haspopup="dialog"
            aria-controls="dossier-chat-dialog"
            aria-expanded={chatOpen}
            aria-busy={chatLoadState === 'loading'}
            onClick={() => void openChat()}
            className="rounded-full border border-line-strong bg-surface px-3 py-2 font-mono text-xs text-text-2 transition-colors duration-150 hover:bg-surface-hover hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Ask the assistant
          </button>
          <p className="font-mono text-xs leading-5 text-text-3">{disclaimer}</p>
        </div>
        <ChatLoadStatus
          state={chatLoadState}
          onRetry={() => void openChat()}
        />
      </div>
      {ChatPanel !== null && (
        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          opener={chatOpenerRef.current}
          intentChips={intentChips}
          disclaimer={disclaimer}
        />
      )}
    </section>
  );
}
