import { isValidElement, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Footer, TERMINAL_OPEN_EVENT } from '@/components/footer';
import * as terminalModule from '@/components/terminal';

interface FocusTarget {
  isConnected?: boolean;
  focus(options?: { preventScroll?: boolean }): void;
}

interface KeyEvent {
  key: string;
  preventDefault(): void;
}

interface KeyTarget {
  addEventListener(type: 'keydown', listener: (event: KeyEvent) => void): void;
  removeEventListener(type: 'keydown', listener: (event: KeyEvent) => void): void;
}

type CloseTerminalDialog = (
  isOpenRef: { current: boolean },
  restoreFocusRef: { current: FocusTarget | null },
  setIsOpen: (isOpen: boolean) => void,
) => void;

type OpenTerminalDialog = (
  isOpenRef: { current: boolean },
  restoreFocusRef: { current: FocusTarget | null },
  opener: FocusTarget | null,
  setIsOpen: (isOpen: boolean) => void,
) => void;

type ListenForTerminalEscape = (
  target: KeyTarget,
  close: () => void,
) => () => void;

type TrapTerminalTab = (
  event: {
    key: string;
    shiftKey: boolean;
    preventDefault(): void;
  },
  dialog: HTMLDivElement | null,
  activeElement: Element | null,
) => void;

type CloseTerminalFromBackdrop = (
  event: { target: EventTarget | null; currentTarget: EventTarget | null },
  close: () => void,
) => void;

function terminalExport<T>(name: string): T {
  const value = (terminalModule as Record<string, unknown>)[name];
  expect(value).toBeTypeOf('function');
  return value as T;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('terminal focus lifecycle', () => {
  it('opens, closes on Escape, and restores the actual opener', () => {
    const openTerminalDialog = terminalExport<OpenTerminalDialog>(
      'openTerminalDialog',
    );
    const closeTerminalDialog = terminalExport<CloseTerminalDialog>(
      'closeTerminalDialog',
    );
    const listenForTerminalEscape = terminalExport<ListenForTerminalEscape>(
      'listenForTerminalEscape',
    );
    const listeners = new Map<string, (event: KeyEvent) => void>();
    const target: KeyTarget = {
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      removeEventListener(type, listener) {
        if (listeners.get(type) === listener) listeners.delete(type);
      },
    };
    const focus = vi.fn();
    const opener = { isConnected: true, focus } satisfies FocusTarget;
    const isOpenRef = { current: false };
    const restoreFocusRef = { current: null as FocusTarget | null };
    const setIsOpen = vi.fn();

    openTerminalDialog(isOpenRef, restoreFocusRef, opener, setIsOpen);
    listenForTerminalEscape(
      target,
      () => closeTerminalDialog(isOpenRef, restoreFocusRef, setIsOpen),
    );
    listeners.get('keydown')?.({ key: 'Escape', preventDefault: vi.fn() });

    expect(setIsOpen.mock.calls).toEqual([[true], [false]]);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('closes on document Escape and removes the listener during cleanup', () => {
    const listenForTerminalEscape = terminalExport<ListenForTerminalEscape>(
      'listenForTerminalEscape',
    );
    const listeners = new Map<string, (event: KeyEvent) => void>();
    const target: KeyTarget = {
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      removeEventListener(type, listener) {
        if (listeners.get(type) === listener) listeners.delete(type);
      },
    };
    const close = vi.fn();
    const preventDefault = vi.fn();

    const cleanup = listenForTerminalEscape(target, close);
    listeners.get('keydown')?.({ key: 'Escape', preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();

    cleanup();
    expect(listeners.has('keydown')).toBe(false);
  });

  it('restores focus to the captured opener when the terminal closes', () => {
    const closeTerminalDialog = terminalExport<CloseTerminalDialog>(
      'closeTerminalDialog',
    );
    const focus = vi.fn();
    const isOpenRef = { current: true };
    const restoreFocusRef = {
      current: { isConnected: true, focus } satisfies FocusTarget,
    };
    const setIsOpen = vi.fn();

    closeTerminalDialog(isOpenRef, restoreFocusRef, setIsOpen);

    expect(isOpenRef.current).toBe(false);
    expect(setIsOpen).toHaveBeenCalledWith(false);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('wraps Tab and Shift+Tab focus within the dialog', () => {
    const trapTerminalTab = terminalExport<TrapTerminalTab>('trapTerminalTab');
    const first = { focus: vi.fn() };
    const last = { focus: vi.fn() };
    const dialog = {
      querySelectorAll: () => [first, last],
    } as unknown as HTMLDivElement;
    const forwardPreventDefault = vi.fn();
    const backwardPreventDefault = vi.fn();

    trapTerminalTab(
      { key: 'Tab', shiftKey: false, preventDefault: forwardPreventDefault },
      dialog,
      last as unknown as Element,
    );
    trapTerminalTab(
      { key: 'Tab', shiftKey: true, preventDefault: backwardPreventDefault },
      dialog,
      first as unknown as Element,
    );

    expect(forwardPreventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();
    expect(backwardPreventDefault).toHaveBeenCalledOnce();
    expect(last.focus).toHaveBeenCalledOnce();
  });

  it('closes from the backdrop, ignores dialog clicks, and restores focus', () => {
    const closeTerminalDialog = terminalExport<CloseTerminalDialog>(
      'closeTerminalDialog',
    );
    const closeTerminalFromBackdrop = terminalExport<CloseTerminalFromBackdrop>(
      'closeTerminalFromBackdrop',
    );
    const focus = vi.fn();
    const isOpenRef = { current: true };
    const restoreFocusRef = {
      current: { isConnected: true, focus } satisfies FocusTarget,
    };
    const setIsOpen = vi.fn();
    const backdrop = {} as EventTarget;
    const dialog = {} as EventTarget;
    const close = () => closeTerminalDialog(isOpenRef, restoreFocusRef, setIsOpen);

    closeTerminalFromBackdrop(
      { target: dialog, currentTarget: backdrop },
      close,
    );
    expect(setIsOpen).not.toHaveBeenCalled();

    closeTerminalFromBackdrop(
      { target: backdrop, currentTarget: backdrop },
      close,
    );

    expect(setIsOpen).toHaveBeenCalledWith(false);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});

describe('Footer terminal opener', () => {
  it('includes the clicked label in the terminal open event', () => {
    class TestEvent {
      constructor(
        readonly type: string,
        readonly init?: { detail?: unknown },
      ) {}

      get detail() {
        return this.init?.detail;
      }
    }

    const dispatchEvent = vi.fn();
    vi.stubGlobal('Event', TestEvent);
    vi.stubGlobal('CustomEvent', TestEvent);
    vi.stubGlobal('window', { dispatchEvent });

    const footer = Footer({ name: 'Test Person' });
    const container = footer.props.children as ReactElement<{ children: unknown }>;
    const paragraphs = container.props.children as ReactElement<{ children: unknown }>[];
    const firstParagraphChildren = paragraphs[0]?.props.children as unknown[];
    const button = firstParagraphChildren.at(-1);
    const opener = { focus: vi.fn() };

    expect(isValidElement(button)).toBe(true);
    if (!isValidElement<{ onClick(event: { currentTarget: unknown }): void }>(button)) return;

    button.props.onClick({ currentTarget: opener });

    expect(dispatchEvent).toHaveBeenCalledOnce();
    const event = dispatchEvent.mock.calls[0]?.[0] as TestEvent;
    expect(event.type).toBe(TERMINAL_OPEN_EVENT);
    expect(event.detail).toBe(opener);
  });
});
