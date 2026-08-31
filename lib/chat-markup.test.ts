import { createElement, type ReactElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Chat,
  ChatComposer,
  ChatTranscript,
  settleTranscriptResponse,
  type TranscriptMessage,
} from '@/components/chat/chat';
import {
  ChatAssistant,
  ChatLauncher,
  ChatPanelLoadStatus,
  listenForChatAssistantOpen,
  updateChatAssistantState,
} from '@/components/chat/chat-assistant';
import { requestChat } from '@/components/chat/chat-transport';
import type { ChatFocusTarget } from '@/components/chat/chat-store';
import { Contact } from '@/components/sections/contact';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';
// @ts-expect-error The Vitest config exposes the stylesheet source as a virtual text module.
import styles from 'virtual:globals-css-source';

const profile = profileJson as Profile;
const intentChips = profile.chat.intent_chips.slice(0, 4);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chat launcher', () => {
  it('renders the terminal glyph and toggles its accessible expanded state', () => {
    const closedMarkup = renderToStaticMarkup(
      createElement(ChatLauncher, {
        open: false,
        onToggle: vi.fn(),
      }),
    );
    const openMarkup = renderToStaticMarkup(
      createElement(ChatLauncher, {
        open: true,
        onToggle: vi.fn(),
      }),
    );

    expect(closedMarkup).toContain('aria-label="Open the assistant"');
    expect(closedMarkup).toContain('aria-expanded="false"');
    expect(closedMarkup).toContain('aria-controls="dossier-chat-dialog"');
    expect(closedMarkup).toContain('data-haptic="true"');
    expect(closedMarkup).toContain('data-chat-icon="terminal"');
    expect(closedMarkup).toContain('aria-hidden="true"');
    expect(openMarkup).toContain('aria-label="Close the assistant"');
    expect(openMarkup).toContain('aria-expanded="true"');
    expect(openMarkup).toContain('data-chat-icon="close"');
  });

  it('keeps one persistent closed dialog stage before the panel chunk loads', () => {
    const markup = renderToStaticMarkup(
      createElement(ChatAssistant, {
        intentChips,
        disclaimer: profile.chat.disclaimer,
      }),
    );

    expect(markup.match(/role="dialog"/g)).toHaveLength(1);
    expect(markup).toContain('id="dossier-chat-dialog"');
    expect(markup).toContain('data-state="closed"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('inert=""');
  });

  it('opens the same state from launcher and contact-button clicks', () => {
    const launcherTrigger = { focus: vi.fn() } as unknown as HTMLButtonElement;
    const contactTrigger = { focus: vi.fn() } as unknown as HTMLButtonElement;
    const openerRef: { current: ChatFocusTarget | null } = { current: null };
    let open = false;
    const setOpen = (nextOpen: boolean) => {
      open = nextOpen;
    };
    const update = (opener: ChatFocusTarget | null) => {
      updateChatAssistantState(openerRef, setOpen, opener);
    };
    const launcher = ChatLauncher({
      open: false,
      onToggle: update,
    }) as ReactElement<{
      onClick(event: { currentTarget: HTMLButtonElement }): void;
    }>;
    const listeners = new Map<string, (event: { detail?: HTMLButtonElement }) => void>();
    const eventTarget = {
      addEventListener: vi.fn((type: string, listener: (event: {}) => void) => {
        listeners.set(type, listener);
      }),
      removeEventListener: vi.fn(),
    };
    listenForChatAssistantOpen(eventTarget, update);

    launcher.props.onClick({ currentTarget: launcherTrigger });
    expect({ open, opener: openerRef.current }).toEqual({
      open: true,
      opener: launcherTrigger,
    });
    update(null);
    listeners.get('dossier:chat-open')?.({ detail: contactTrigger });
    expect({ open, opener: openerRef.current }).toEqual({
      open: true,
      opener: contactTrigger,
    });
  });

  it('keeps Contact to one secondary trigger with no inline panel', () => {
    const markup = renderToStaticMarkup(
      createElement(Contact, {
        email: profile.identity.email,
        socials: profile.identity.socials,
      }),
    );

    expect(markup).toContain('Ask the assistant');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('data-chat-open="true"');
    expect(markup).toContain('data-copy-email=');
    expect(markup).toMatch(/data-copy-email=[^>]*data-haptic="true"/);
    expect(markup).not.toContain('role="dialog"');
    expect(markup).not.toContain(profile.chat.disclaimer.replaceAll("'", '&#x27;'));
  });

  it('shows loading and retry feedback for the deferred panel chunk', () => {
    const loadingMarkup = renderToStaticMarkup(
      createElement(ChatPanelLoadStatus, {
        failed: false,
        onRetry: vi.fn(),
      }),
    );
    const errorMarkup = renderToStaticMarkup(
      createElement(ChatPanelLoadStatus, {
        failed: true,
        onRetry: vi.fn(),
      }),
    );
    expect(loadingMarkup).toContain('role="status"');
    expect(loadingMarkup).toContain('Opening assistant');
    expect(errorMarkup).toContain('role="alert"');
    expect(errorMarkup).toContain('The assistant interface could not load.');
    expect(errorMarkup).toContain('Retry');
  });

});

describe('chat panel markup', () => {
  it('uses the reduced panel glow in both color themes', () => {
    expect(styles).toContain(
      'box-shadow: 0 12px 32px color-mix(in oklab, var(--text-1) 11%, transparent);',
    );
    expect(styles).not.toContain(
      'box-shadow: 0 24px 64px color-mix(in oklab, var(--text-1) 22%, transparent);',
    );
  });

  it('renders the dossier panel content, status, empty state, intents, and composer', () => {
    const markup = renderToStaticMarkup(
      createElement(Chat, {
        open: true,
        onClose: vi.fn(),
        intentChips,
        disclaimer: profile.chat.disclaimer,
        reducedMotion: false,
      }),
    );

    expect(markup).toContain('chat-panel-content');
    expect(markup).toContain('Assistant terminal');
    expect(markup).toContain('data-chat-status="idle"');
    expect(markup).toContain('published roles, projects, or accolades.');
    expect(markup).toContain('role="log"');
    expect(markup).toContain('maxLength="500"');
    expect(markup).toContain('focus-visible:outline-ring');
    expect(markup).toContain('aria-label="Send"');
    for (const intent of intentChips) {
      expect(markup).toContain(intent.replaceAll('&', '&amp;'));
    }
  });

  it('renders visitor and assistant bubbles plus canned replies as system notes', async () => {
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
    const messages = settleTranscriptResponse(
      [
        { id: 1, role: 'user', content: 'Question' },
        { id: 2, role: 'assistant', content: '' },
      ],
      2,
      3,
      result,
    );
    messages.splice(1, 0, {
      id: 4,
      role: 'assistant',
      content: 'Published profile answer.',
    });
    const markup = renderToStaticMarkup(
      createElement(ChatTranscript, {
        messages,
        streaming: false,
        reducedMotion: false,
      }),
    );

    expect(markup).toContain('data-message-role="visitor"');
    expect(markup).toContain('data-message-role="assistant"');
    expect(markup).toContain('data-message-kind="system"');
    expect(markup).toContain('border-dashed');
    expect(markup).toContain(answer);
  });

  it('shows thinking dots before the first delta and a caret while streaming text', () => {
    const thinkingMessages: TranscriptMessage[] = [
      { id: 1, role: 'user', content: 'Question' },
      { id: 2, role: 'assistant', content: '' },
    ];
    const streamingMessages: TranscriptMessage[] = [
      { id: 1, role: 'user', content: 'Question' },
      { id: 2, role: 'assistant', content: 'Streaming answer' },
    ];
    const thinkingMarkup = renderToStaticMarkup(
      createElement(ChatTranscript, {
        messages: thinkingMessages,
        streaming: true,
        reducedMotion: false,
      }),
    );
    const streamingMarkup = renderToStaticMarkup(
      createElement(ChatTranscript, {
        messages: streamingMessages,
        streaming: true,
        reducedMotion: false,
      }),
    );

    expect(thinkingMarkup).toContain('aria-label="Assistant is thinking"');
    expect(thinkingMarkup.match(/chat-thinking-dot/g)).toHaveLength(3);
    expect(streamingMarkup).toContain('data-stream-caret="true"');
  });

  it('disables send while streaming and puts a 429 countdown inside the send button', () => {
    const streamingMarkup = renderToStaticMarkup(
      createElement(ChatComposer, {
        input: 'Next question',
        streaming: true,
        retrySeconds: 0,
        disclaimer: profile.chat.disclaimer,
        reducedMotion: false,
        onInput: vi.fn(),
        onSend: vi.fn(),
      }),
    );
    const retryMarkup = renderToStaticMarkup(
      createElement(ChatComposer, {
        input: 'Try again',
        streaming: false,
        retrySeconds: 12,
        disclaimer: profile.chat.disclaimer,
        reducedMotion: false,
        onInput: vi.fn(),
        onSend: vi.fn(),
      }),
    );

    expect(streamingMarkup).toContain('aria-label="Send"');
    expect(streamingMarkup).toContain('disabled=""');
    expect(streamingMarkup).toContain('data-haptic="true"');
    expect(retryMarkup).toContain('aria-label="Send in 12 seconds"');
    expect(retryMarkup).toContain('>12s<');
    expect(retryMarkup).not.toContain('data-chat-icon="send"');
  });

  it('reveals the character counter only past 400 characters', () => {
    const hiddenMarkup = renderToStaticMarkup(
      createElement(ChatComposer, {
        input: 'a'.repeat(400),
        streaming: false,
        retrySeconds: 0,
        disclaimer: profile.chat.disclaimer,
        reducedMotion: false,
        onInput: vi.fn(),
        onSend: vi.fn(),
      }),
    );
    const visibleMarkup = renderToStaticMarkup(
      createElement(ChatComposer, {
        input: 'a'.repeat(401),
        streaming: false,
        retrySeconds: 0,
        disclaimer: profile.chat.disclaimer,
        reducedMotion: false,
        onInput: vi.fn(),
        onSend: vi.fn(),
      }),
    );

    expect(hiddenMarkup).toContain('data-counter-visible="false"');
    expect(visibleMarkup).toContain('data-counter-visible="true"');
    expect(visibleMarkup).toContain('401/500');
  });

  it('renders the reduced-motion path without transition classes', () => {
    const markup = renderToStaticMarkup(
      createElement(ChatAssistant, {
        intentChips,
        disclaimer: profile.chat.disclaimer,
        reducedMotion: true,
      }),
    );

    expect(markup).toContain('chat-panel-frame');
    expect(markup).not.toContain('chat-panel-motion');

    const errorMarkup = renderToStaticMarkup(
      createElement(ChatPanelLoadStatus, {
        failed: true,
        onRetry: vi.fn(),
      }),
    );
    expect(errorMarkup).not.toContain('chat-control-motion');
  });

  it('escapes script-like answers as text', () => {
    const unsafe = '<script>alert("owned")</script>';
    const messages: TranscriptMessage[] = [
      { id: 1, role: 'assistant', content: unsafe },
    ];
    const markup = renderToStaticMarkup(
      createElement(ChatTranscript, {
        messages,
        streaming: false,
        reducedMotion: false,
      }),
    );

    expect(markup).toContain('&lt;script&gt;alert(&quot;owned&quot;)&lt;/script&gt;');
    expect(markup).not.toContain('<script>');
  });
});
