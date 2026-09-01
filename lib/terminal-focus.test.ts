import { createElement, isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FooterTerminalTrigger } from '@/components/footer-terminal-trigger';
import { SiteNav } from '@/components/site-nav';
import * as siteNavModule from '@/components/site-nav';
import * as terminalModule from '@/components/terminal';
// @ts-expect-error Vite exposes source files with the raw query as text.
import terminalSource from '@/components/terminal.tsx?raw';
import { TERMINAL_OPEN_EVENT } from '@/lib/terminal-events';

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
  it('focuses its command input without scrolling and keeps focus-visible styling', () => {
    expect(terminalSource).not.toMatch(/\bautoFocus\b/);
    expect(terminalSource).toContain('.focus({ preventScroll: true })');
    expect(terminalSource).toContain('focus-visible:outline-2');
    expect(terminalSource).not.toContain(' focus:outline-');
  });

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

    const button = FooterTerminalTrigger();
    const opener = { focus: vi.fn() };

    button.props.onClick({ currentTarget: opener });

    expect(button.props['data-haptic']).toBe(true);

    expect(dispatchEvent).toHaveBeenCalledOnce();
    const event = dispatchEvent.mock.calls[0]?.[0] as TestEvent;
    expect(event.type).toBe(TERMINAL_OPEN_EVENT);
    expect(event.detail).toBe(opener);
  });
});

describe('SiteNav terminal opener', () => {
  it('renders the non-wrapping Zuriel Shanley wordmark without changing its controls', () => {
    const markup = renderToStaticMarkup(createElement(SiteNav));

    expect(markup).toContain('aria-label="Zuriel Shanley"');
    expect(markup).toMatch(/data-nav-wordmark="true"[^>]*>Zuriel Shanley<\/span>/);
    expect(markup).not.toContain('data-slot="shimmering-text"');
    expect(markup).toContain('whitespace-nowrap');
    expect(markup).not.toMatch(/>ZST<\/span>/);
    expect(markup).not.toContain('>zurielst.com<');
    expect(markup).toContain('lg:flex');
    expect(markup).toContain('lg:hidden');
    expect(markup).not.toContain('md:flex');
    expect(markup).toContain('data-terminal-trigger="true"');
    expect(markup).toContain('data-command-palette-trigger="true"');
    expect(markup.match(/data-haptic="true"/g) ?? []).toHaveLength(2);
    expect(markup).toMatch(/<kbd[^>]*>Ctrl<\/kbd>/);
    expect(markup).toMatch(/<kbd[^>]*>K<\/kbd>/);
    expect(markup).toContain('data-mobile-nav-link="true"');
    expect(markup).toContain('id="site-nav-enhancement"');
  });

  it('delegates terminal, palette, and mobile-menu actions from server markup', () => {
    type EnhanceSiteNav = (
      nav: { addEventListener(type: string, listener: (event: { target: unknown }) => void): void },
      runtime: {
        CustomEvent: typeof TestEvent;
        dispatchEvent(event: TestEvent): void;
      },
    ) => void;
    class TestEvent {
      constructor(
        readonly type: string,
        readonly init?: { detail?: unknown },
      ) {}

      get detail() {
        return this.init?.detail;
      }
    }

    const listeners = new Map<string, (event: { target: unknown }) => void>();
    const dispatchEvent = vi.fn();
    const enhanceSiteNav = Reflect.get(
      siteNavModule,
      'enhanceSiteNav',
    ) as unknown as EnhanceSiteNav | undefined;

    expect(enhanceSiteNav).toBeTypeOf('function');
    if (!enhanceSiteNav) return;
    enhanceSiteNav(
      {
        addEventListener(type, listener) {
          listeners.set(type, listener);
        },
      },
      { CustomEvent: TestEvent, dispatchEvent },
    );

    const terminalTrigger = {
      closest(selector: string) {
        return selector === '[data-terminal-trigger]' ? this : null;
      },
    };
    listeners.get('click')?.({ target: terminalTrigger });

    expect(dispatchEvent).toHaveBeenCalledOnce();
    const event = dispatchEvent.mock.calls[0]?.[0] as TestEvent;
    expect(event.type).toBe(TERMINAL_OPEN_EVENT);
    expect(event.detail).toBe(terminalTrigger);

    const paletteTrigger = {
      closest(selector: string) {
        return selector === '[data-command-palette-trigger]' ? this : null;
      },
    };
    listeners.get('click')?.({ target: paletteTrigger });
    expect((dispatchEvent.mock.calls[1]?.[0] as TestEvent).type).toBe(
      'dossier:command-palette-open',
    );

    const removeAttribute = vi.fn();
    const details = { removeAttribute };
    const mobileLink = {
      closest(selector: string) {
        if (selector === '[data-mobile-nav-link]') return this;
        if (selector === 'details') return details;
        return null;
      },
    };
    listeners.get('click')?.({ target: mobileLink });
    expect(removeAttribute).toHaveBeenCalledWith('open');
  });

  it('replays a terminal click made before the terminal listener mounts exactly once', () => {
    interface PendingRequestRuntime {
      CustomEvent: typeof TestEvent;
      __dossierPendingOpenRequests?: Array<{ detail: unknown; eventType: string }>;
      addEventListener(type: string, listener: (event: TestEvent) => void): void;
      dispatchEvent(event: TestEvent): void;
      removeEventListener(type: string, listener: (event: TestEvent) => void): void;
    }
    type EnhanceSiteNav = (
      nav: { addEventListener(type: string, listener: (event: { target: unknown }) => void): void },
      runtime: PendingRequestRuntime,
    ) => void;
    type ListenForTerminalOpen = (
      target: PendingRequestRuntime,
      open: (opener?: unknown) => void,
    ) => () => void;
    class TestEvent {
      constructor(
        readonly type: string,
        readonly init?: { detail?: unknown },
      ) {}

      get detail() {
        return this.init?.detail;
      }
    }

    const navListeners = new Map<string, (event: { target: unknown }) => void>();
    const runtimeListeners = new Map<string, (event: TestEvent) => void>();
    const runtime: PendingRequestRuntime = {
      CustomEvent: TestEvent,
      addEventListener(type, listener) {
        runtimeListeners.set(type, listener);
      },
      dispatchEvent(event) {
        runtimeListeners.get(event.type)?.(event);
      },
      removeEventListener(type, listener) {
        if (runtimeListeners.get(type) === listener) runtimeListeners.delete(type);
      },
    };
    const enhanceSiteNav = Reflect.get(
      siteNavModule,
      'enhanceSiteNav',
    ) as unknown as EnhanceSiteNav;
    const listenForTerminalOpen = Reflect.get(
      terminalModule,
      'listenForTerminalOpen',
    ) as ListenForTerminalOpen | undefined;
    const trigger = {
      closest(selector: string) {
        return selector === '[data-terminal-trigger]' ? this : null;
      },
    };
    const open = vi.fn();

    enhanceSiteNav(
      {
        addEventListener(type, listener) {
          navListeners.set(type, listener);
        },
      },
      runtime,
    );
    navListeners.get('click')?.({ target: trigger });

    expect(open).not.toHaveBeenCalled();
    expect(runtime.__dossierPendingOpenRequests).toEqual([
      { detail: trigger, eventType: TERMINAL_OPEN_EVENT },
    ]);
    expect(listenForTerminalOpen).toBeTypeOf('function');
    if (!listenForTerminalOpen) return;

    const cleanup = listenForTerminalOpen(runtime, open);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenLastCalledWith(trigger);
    expect(runtime.__dossierPendingOpenRequests).toBeUndefined();

    navListeners.get('click')?.({ target: trigger });

    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith(trigger);
    expect(runtime.__dossierPendingOpenRequests).toBeUndefined();

    cleanup();
  });
});
