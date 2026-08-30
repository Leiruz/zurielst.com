import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Chat, ChatTranscript, type TranscriptMessage } from '@/components/chat/chat';
import { requestChat } from '@/components/chat/chat-transport';
import { ChatLoadStatus, Contact } from '@/components/sections/contact';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';

const profile = profileJson as Profile;
const intentChips = profile.chat.intent_chips.slice(0, 4);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chat launcher', () => {
  it('replaces the disabled launch chip with an enabled assistant launcher', () => {
    const markup = renderToStaticMarkup(
      createElement(Contact, {
        email: profile.identity.email,
        socials: profile.identity.socials,
        disclaimer: profile.chat.disclaimer,
        intentChips,
      }),
    );

    expect(markup).toContain('Ask the assistant');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain(profile.chat.disclaimer.replaceAll("'", '&#x27;'));
    expect(markup).not.toContain('Assistant arrives at launch');
  });

  it('shows a visible retry control if the deferred panel chunk fails to load', () => {
    const markup = renderToStaticMarkup(
      createElement(ChatLoadStatus, {
        state: 'error',
        onRetry: vi.fn(),
      }),
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('The assistant interface could not load.');
    expect(markup).toContain('Retry');
  });
});

describe('chat panel markup', () => {
  it('renders the dialog, first-open intents, live transcript, and character counter', () => {
    const markup = renderToStaticMarkup(
      createElement(Chat, {
        open: true,
        onClose: vi.fn(),
        opener: null,
        intentChips,
        disclaimer: profile.chat.disclaimer,
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('Fig. 9A. Assistant terminal');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('maxLength="500"');
    expect(markup).toContain('0/500');
    expect(markup).toContain('max-h-[calc(100dvh-1.5rem)]');
    expect(markup).toContain('overflow-y-auto');
    expect(markup).toContain('sticky top-0');
    for (const intent of intentChips) expect(markup).toContain(intent.replaceAll('&', '&amp;'));
  });

  it('renders a fetched canned JSON reply in the transcript', async () => {
    const answer = 'The assistant has reached its daily conversation budget.';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ answer }), {
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }),
      ),
    );
    const result = await requestChat({
      message: 'Question',
      history: [],
      signal: new AbortController().signal,
      onDelta: vi.fn(),
    });

    const messages: TranscriptMessage[] = [
      { id: 1, role: 'assistant', content: result.answer },
    ];
    const markup = renderToStaticMarkup(
      createElement(ChatTranscript, { messages, streaming: false }),
    );

    expect(markup).toContain(answer);
  });

  it('escapes script-like answers as text', () => {
    const unsafe = '<script>alert("owned")</script>';
    const messages: TranscriptMessage[] = [
      { id: 1, role: 'assistant', content: unsafe },
    ];
    const markup = renderToStaticMarkup(
      createElement(ChatTranscript, { messages, streaming: false }),
    );

    expect(markup).toContain('&lt;script&gt;alert(&quot;owned&quot;)&lt;/script&gt;');
    expect(markup).not.toContain('<script>');
  });
});
