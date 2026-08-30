import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  appendTranscriptDelta,
  canSendChat,
  chatCharacterCount,
  closeChatPanel,
  completeTranscriptAnswer,
  containChatShortcut,
  focusStreamingControl,
  listenForChatEscape,
  startRetryCountdown,
  transcriptHistory,
  type TranscriptMessage,
} from '@/components/chat/chat';

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

  it('counts the same UTF-16 units enforced by the native input and API schema', () => {
    const atLimit = '😀'.repeat(250);
    const overLimit = `${atLimit}a`;

    expect(chatCharacterCount(atLimit)).toBe(500);
    expect(canSendChat(atLimit, false, 0)).toBe(true);
    expect(chatCharacterCount(overLimit)).toBe(501);
    expect(canSendChat(overLimit, false, 0)).toBe(false);
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

  it('aborts the active request and restores opener focus on close', () => {
    const controller = new AbortController();
    const controllerRef = { current: controller as AbortController | null };
    const focus = vi.fn();
    const onClose = vi.fn();

    closeChatPanel(controllerRef, onClose, { isConnected: true, focus });

    expect(controller.signal.aborted).toBe(true);
    expect(controllerRef.current).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('moves focus to an enabled close control before streaming disables inputs', () => {
    const focus = vi.fn();

    focusStreamingControl({ focus });

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('contains the terminal shortcut while the chat modal owns focus', () => {
    const stopPropagation = vi.fn();

    containChatShortcut({ key: '`', stopPropagation });
    containChatShortcut({ key: 'Tab', stopPropagation });

    expect(stopPropagation).toHaveBeenCalledOnce();
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
});
