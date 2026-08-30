import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  appendTranscriptDelta,
  canSendChat,
  canStartChatRequest,
  chatCharacterCount,
  closeChatPanel,
  completeTranscriptAnswer,
  containChatShortcut,
  focusChatInput,
  listenForChatEscape,
  listenForMobileSheetScroll,
  lockMobileSheetScroll,
  shouldSendChatOnKeyDown,
  shouldSettleChatStreaming,
  shouldStickToTranscript,
  settleTranscriptResponse,
  startRetryCountdown,
  trapChatTab,
  trimTranscript,
  transcriptScrollDestination,
  transcriptHistory,
  type TranscriptMessage,
} from '@/components/chat/chat';
import { updateChatAssistantState } from '@/components/chat/chat-assistant';
import {
  claimAssistantAttention,
  claimBrowserAssistantAttention,
  type ChatFocusTarget,
} from '@/components/chat/chat-store';

afterEach(() => {
  vi.useRealTimers();
});

describe('chat state', () => {
  it('appends streaming deltas without replacing earlier transcript text', () => {
    const messages: TranscriptMessage[] = [
      { id: 1, role: 'user', content: 'Question' },
      { id: 2, role: 'assistant', content: 'First' },
    ];

    const first = appendTranscriptDelta(messages, 2, ' second');
    const second = appendTranscriptDelta(first, 2, ' third');

    expect(second).toEqual([
      { id: 1, role: 'user', content: 'Question' },
      { id: 2, role: 'assistant', content: 'First second third' },
    ]);
    expect(messages[1]?.content).toBe('First');
  });

  it('keeps partial streamed text when a later parse failure adds a fallback', () => {
    const messages: TranscriptMessage[] = [
      { id: 1, role: 'assistant', content: 'Validated partial text.' },
    ];

    const completed = completeTranscriptAnswer(
      messages,
      1,
      'The assistant is unavailable right now.',
    );

    expect(completed[0]?.content).toBe(
      'Validated partial text.\n\nThe assistant is unavailable right now.',
    );
  });

  it('keeps partial streamed text as a bubble and adds a failed response as a system note', () => {
    const messages: TranscriptMessage[] = [
      { id: 1, role: 'user', content: 'Question' },
      { id: 2, role: 'assistant', content: 'Validated partial text.' },
    ];

    expect(settleTranscriptResponse(messages, 2, 3, {
      answer: 'The assistant is unavailable right now.',
      retryAfterSeconds: 0,
      streamed: false,
    })).toEqual([
      { id: 1, role: 'user', content: 'Question' },
      { id: 2, role: 'assistant', content: 'Validated partial text.' },
      {
        id: 3,
        role: 'assistant',
        content: 'The assistant is unavailable right now.',
        presentation: 'system',
      },
    ]);
  });

  it('replaces an empty assistant placeholder with a canned system note', () => {
    const messages: TranscriptMessage[] = [
      { id: 1, role: 'user', content: 'Question' },
      { id: 2, role: 'assistant', content: '' },
    ];

    expect(settleTranscriptResponse(messages, 2, 3, {
      answer: 'Daily conversation budget reached.',
      retryAfterSeconds: 30,
      streamed: false,
    })).toEqual([
      { id: 1, role: 'user', content: 'Question' },
      {
        id: 3,
        role: 'assistant',
        content: 'Daily conversation budget reached.',
        presentation: 'system',
      },
    ]);
  });

  it('keeps only the last four nonempty transcript turns for history', () => {
    const messages: TranscriptMessage[] = [
      { id: 1, role: 'user', content: 'one' },
      { id: 2, role: 'assistant', content: 'two' },
      { id: 3, role: 'assistant', content: '   \n' },
      { id: 4, role: 'user', content: 'three' },
      { id: 5, role: 'assistant', content: 'four' },
      { id: 6, role: 'user', content: 'five' },
    ];

    expect(transcriptHistory(messages)).toEqual([
      { role: 'assistant', content: 'two' },
      { role: 'user', content: 'three' },
      { role: 'assistant', content: 'four' },
      { role: 'user', content: 'five' },
    ]);
  });

  it('excludes system notes from future conversation history', () => {
    const messages: TranscriptMessage[] = [
      { id: 1, role: 'user', content: 'Question' },
      {
        id: 2,
        role: 'assistant',
        content: 'Daily budget reached.',
        presentation: 'system',
      },
    ];

    expect(transcriptHistory(messages)).toEqual([
      { role: 'user', content: 'Question' },
    ]);
  });

  it('bounds the rendered transcript while retaining the newest messages', () => {
    const messages = Array.from({ length: 61 }, (_, index): TranscriptMessage => ({
      id: index + 1,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${index + 1}`,
    }));

    const trimmed = trimTranscript(messages);

    expect(trimmed).toHaveLength(60);
    expect(trimmed[0]?.id).toBe(2);
    expect(trimmed.at(-1)?.id).toBe(61);
  });

  it('counts the same UTF-16 units enforced by the native input and API schema', () => {
    const atLimit = '😀'.repeat(250);
    const overLimit = `${atLimit}a`;

    expect(chatCharacterCount(atLimit)).toBe(500);
    expect(canSendChat(atLimit, false, 0)).toBe(true);
    expect(chatCharacterCount(overLimit)).toBe(501);
    expect(canSendChat(overLimit, false, 0)).toBe(false);
  });

  it('blocks a second request before React commits the streaming state', () => {
    const activeController = new AbortController();

    expect(canStartChatRequest(null, 'Question', false, 0)).toBe(true);
    expect(canStartChatRequest(activeController, 'Question', false, 0)).toBe(false);
  });

  it('counts a retry window down to zero before resend is enabled', async () => {
    vi.useFakeTimers();
    const ticks: number[] = [];

    const cleanup = startRetryCountdown(2, (seconds) => ticks.push(seconds));
    expect(canSendChat('Try again', false, ticks.at(-1) ?? 0)).toBe(false);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(ticks).toEqual([2, 1]);
    expect(canSendChat('Try again', false, ticks.at(-1) ?? 0)).toBe(false);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(ticks).toEqual([2, 1, 0]);
    expect(canSendChat('Try again', false, ticks.at(-1) ?? 0)).toBe(true);

    cleanup();
  });

  it('derives retry time from a deadline after throttled timer callbacks', () => {
    const ticks: number[] = [];
    let now = 0;
    let scheduled: (() => void) | undefined;
    const cancel = vi.fn();

    startRetryCountdown(
      2,
      (seconds) => ticks.push(seconds),
      (callback) => {
        scheduled = callback;
        return 1 as unknown as ReturnType<typeof globalThis.setInterval>;
      },
      cancel,
      () => now,
    );

    now = 2_500;
    scheduled?.();

    expect(ticks).toEqual([2, 0]);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('aborts the active request before delegating panel close', () => {
    const controller = new AbortController();
    const controllerRef = { current: controller as AbortController | null };
    const onClose = vi.fn();

    closeChatPanel(controllerRef, onClose);

    expect(controller.signal.aborted).toBe(true);
    expect(controllerRef.current).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('moves focus to the message input when the panel opens', () => {
    const focus = vi.fn();
    const scrollIntoView = vi.fn();

    focusChatInput({ focus, scrollIntoView }, true);

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('sends on Enter while preserving Shift+Enter for a newline', () => {
    expect(shouldSendChatOnKeyDown({
      key: 'Enter',
      shiftKey: false,
      isComposing: false,
    })).toBe(true);
    expect(shouldSendChatOnKeyDown({
      key: 'Enter',
      shiftKey: true,
      isComposing: false,
    })).toBe(false);
    expect(shouldSendChatOnKeyDown({
      key: 'Enter',
      shiftKey: false,
      isComposing: true,
    })).toBe(false);
  });

  it('does not let an aborted request clear a newer streaming state', () => {
    const first = new AbortController();
    const second = new AbortController();

    expect(shouldSettleChatStreaming(first, first)).toBe(true);
    expect(shouldSettleChatStreaming(null, first)).toBe(true);
    expect(shouldSettleChatStreaming(second, first)).toBe(false);
  });

  it('pins autoscroll near the bottom and releases it after the visitor scrolls up', () => {
    expect(shouldStickToTranscript({
      scrollTop: 180,
      scrollHeight: 400,
      clientHeight: 200,
    })).toBe(true);
    expect(shouldStickToTranscript({
      scrollTop: 120,
      scrollHeight: 400,
      clientHeight: 200,
    })).toBe(false);
    expect(shouldStickToTranscript({
      scrollTop: 200,
      scrollHeight: 400,
      clientHeight: 200,
    })).toBe(true);
    expect(transcriptScrollDestination(0, true, 400)).toBe(0);
    expect(transcriptScrollDestination(1, true, 400)).toBe(400);
    expect(transcriptScrollDestination(1, false, 400)).toBeNull();
  });

  it('locks body scroll for the mobile sheet only and restores the prior value', () => {
    const desktopBody = { dataset: {}, style: { overflow: 'scroll' } };
    const mobileBody = { dataset: {}, style: { overflow: 'auto' } };

    const unlockDesktop = lockMobileSheetScroll(desktopBody, false);
    const unlockMobile = lockMobileSheetScroll(mobileBody, true);
    expect(desktopBody).toEqual({ dataset: {}, style: { overflow: 'scroll' } });
    expect(mobileBody).toEqual({
      dataset: { chatOpen: 'true' },
      style: { overflow: 'hidden' },
    });

    unlockDesktop();
    unlockMobile();
    expect(desktopBody).toEqual({ dataset: {}, style: { overflow: 'scroll' } });
    expect(mobileBody).toEqual({ dataset: {}, style: { overflow: 'auto' } });
  });

  it('updates the body lock when an open sheet crosses the mobile breakpoint', () => {
    const body = { dataset: {}, style: { overflow: 'auto' } };
    let listener: (() => void) | undefined;
    const media = {
      matches: false,
      addEventListener: vi.fn((_type: 'change', next: () => void) => {
        listener = next;
      }),
      removeEventListener: vi.fn(),
    };

    const cleanup = listenForMobileSheetScroll(body, media);
    expect(body.style.overflow).toBe('auto');

    media.matches = true;
    listener?.();
    expect(body.style.overflow).toBe('hidden');

    media.matches = false;
    listener?.();
    expect(body.style.overflow).toBe('auto');

    cleanup();
    expect(media.removeEventListener).toHaveBeenCalledOnce();
  });

  it('claims one launcher attention pulse per session and skips reduced motion', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };

    expect(claimAssistantAttention(storage, false)).toBe(true);
    expect(claimAssistantAttention(storage, false)).toBe(false);
    values.clear();
    expect(claimAssistantAttention(storage, true)).toBe(false);
    expect(values.size).toBe(0);
  });

  it('skips attention safely when browser storage access is restricted', () => {
    const browser = Object.defineProperty({}, 'sessionStorage', {
      get() {
        throw new Error('Storage is unavailable');
      },
    });

    expect(claimBrowserAssistantAttention(browser, false)).toBe(false);
  });

  it('contains global dialog shortcuts while the chat owns focus', () => {
    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();

    containChatShortcut({ key: '`', ctrlKey: false, metaKey: false, preventDefault, stopPropagation });
    containChatShortcut({ key: 'k', ctrlKey: true, metaKey: false, preventDefault, stopPropagation });
    containChatShortcut({ key: 'Tab', ctrlKey: false, metaKey: false, preventDefault, stopPropagation });

    expect(stopPropagation).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('closes on Escape and removes its listener during cleanup', () => {
    const listeners = new Set<(event: KeyboardEvent) => void>();
    const target = {
      addEventListener: vi.fn((_type: 'keydown', listener: (event: KeyboardEvent) => void) => {
        listeners.add(listener);
      }),
      removeEventListener: vi.fn((_type: 'keydown', listener: (event: KeyboardEvent) => void) => {
        listeners.delete(listener);
      }),
    };
    const close = vi.fn();
    const preventDefault = vi.fn();

    const cleanup = listenForChatEscape(target, close);
    for (const listener of listeners) {
      listener({ key: 'Escape', preventDefault } as unknown as KeyboardEvent);
    }

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    cleanup();
    expect(listeners.size).toBe(0);
  });

  it('cycles focus inside the dialog in both directions', () => {
    const focusFirst = vi.fn();
    const focusLast = vi.fn();
    const first = { focus: focusFirst } as unknown as HTMLElement;
    const last = { focus: focusLast } as unknown as HTMLElement;
    const dialog = {
      querySelectorAll: () => [first, last],
    } as unknown as HTMLDivElement;
    const forward = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() };
    const reverse = { key: 'Tab', shiftKey: true, preventDefault: vi.fn() };
    const reverseFromFrame = { key: 'Tab', shiftKey: true, preventDefault: vi.fn() };

    trapChatTab(forward, dialog, last);
    trapChatTab(reverse, dialog, first);
    trapChatTab(reverseFromFrame, dialog, dialog);

    expect(forward.preventDefault).toHaveBeenCalledOnce();
    expect(reverse.preventDefault).toHaveBeenCalledOnce();
    expect(reverseFromFrame.preventDefault).toHaveBeenCalledOnce();
    expect(focusFirst).toHaveBeenCalledOnce();
    expect(focusLast).toHaveBeenCalledTimes(2);
  });
});

describe('chat assistant shared state', () => {
  it('uses one state source and restores only the trigger that opened the panel', () => {
    const launcherFocus = vi.fn();
    const contactFocus = vi.fn();
    const launcher = { isConnected: true, focus: launcherFocus };
    const contact = { isConnected: true, focus: contactFocus };
    const openerRef: { current: ChatFocusTarget | null } = { current: null };
    let open = false;
    const updates: boolean[] = [];
    const setOpen = (nextOpen: boolean) => {
      open = nextOpen;
      updates.push(nextOpen);
    };

    updateChatAssistantState(openerRef, setOpen, launcher);
    expect({ open, opener: openerRef.current }).toEqual({ open: true, opener: launcher });
    updateChatAssistantState(openerRef, setOpen, null);
    expect({ open, opener: openerRef.current }).toEqual({ open: false, opener: null });
    expect(launcherFocus).toHaveBeenCalledWith({ preventScroll: true });

    updateChatAssistantState(openerRef, setOpen, contact);
    expect({ open, opener: openerRef.current }).toEqual({ open: true, opener: contact });
    updateChatAssistantState(openerRef, setOpen, null);
    expect({ open, opener: openerRef.current }).toEqual({ open: false, opener: null });
    expect(contactFocus).toHaveBeenCalledWith({ preventScroll: true });
    expect(updates).toEqual([true, false, true, false]);
  });
});
