import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommandPalette } from '@/components/command-palette';
// @ts-expect-error Vite exposes source files with the raw query as text.
import commandPaletteSource from '@/components/command-palette.tsx?raw';
import * as siteNavModule from '@/components/site-nav';
import {
  COMMAND_PALETTE_OPEN_EVENT,
  closeCommandPalette,
  createCommandPaletteLoadController,
  listenForPaletteOpen,
} from '@/components/command-palette-loader';
import {
  activateCommandPaletteAction,
  createCommandPaletteActions,
  filterCommandPaletteActions,
  handleCommandPaletteDialogKey,
  handleCommandPaletteInputKey,
  keepCommandPaletteSelectionVisible,
  moveCommandPaletteSelection,
  trapCommandPaletteTab,
  type CommandPaletteAction,
} from '@/lib/command-palette';
// @ts-expect-error The Vitest config exposes the stylesheet source as a virtual text module.
import styles from 'virtual:globals-css-source';

const config = {
  email: 'zurielst@u.nus.edu',
  githubUrl: 'https://github.com/Leiruz',
  linkedInUrl: 'https://www.linkedin.com/in/zuriel-shanley/',
  sourceUrl: 'https://github.com/Leiruz/zurielst.com',
};

function action(label: string): CommandPaletteAction {
  const found = createCommandPaletteActions(config).find(
    (candidate) => candidate.label === label,
  );
  expect(found).toBeDefined();
  return found as CommandPaletteAction;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('command palette action model', () => {
  it('exposes exactly 23 actions in the required groups and page order', () => {
    const actions = createCommandPaletteActions(config);

    expect(actions).toHaveLength(23);
    expect(actions.map((item) => item.group)).toEqual([
      ...Array<string>(13).fill('Sections'),
      ...Array<string>(6).fill('Actions'),
      ...Array<string>(4).fill('Links'),
    ]);
    expect(actions.slice(0, 13).map((item) => item.label)).toEqual([
      'Identity',
      'Introduction',
      'Contributions',
      'Capabilities',
      'Stack',
      'Selected work',
      'Timeline',
      'Education',
      'Accolades',
      'Products',
      'Brands',
      'FAQ',
      'Contact',
    ]);
    expect(actions.slice(13).map((item) => item.label)).toEqual([
      'Download resume',
      'Download vCard',
      'Open terminal',
      'Light theme',
      'Dark theme',
      'Copy email',
      'GitHub',
      'LinkedIn',
      'View source',
      'llms.txt',
    ]);
  });

  it('gives the public downloads and llms file their exact internal hrefs', () => {
    expect(action('Download resume')).toMatchObject({
      href: '/media/resume.pdf',
      download: true,
    });
    expect(action('Download vCard')).toMatchObject({
      href: '/zurielst.vcf',
      download: true,
    });
    expect(action('llms.txt')).toMatchObject({
      href: '/llms.txt',
      external: false,
    });
  });

  it('provides only explicit light and dark theme commands', () => {
    const themeActions = createCommandPaletteActions(config).filter(
      (item) => item.kind === 'theme',
    );

    expect(themeActions).toEqual([
      expect.objectContaining({ label: 'Light theme', theme: 'light' }),
      expect.objectContaining({ label: 'Dark theme', theme: 'dark' }),
    ]);
    expect(themeActions.map((item) => item.label)).not.toContain('System theme');
    expect(themeActions.map((item) => item.label)).not.toContain('Toggle theme');
  });

  it('maps the nine global g sequences onto their stable section rows', () => {
    const shortcuts = createCommandPaletteActions(config)
      .filter((item): item is Extract<CommandPaletteAction, { kind: 'section' }> =>
        item.kind === 'section' && Boolean(item.shortcut))
      .map((item) => [item.shortcut?.join(' '), item.targetId]);

    expect(shortcuts).toEqual([
      ['g i', 'identity'],
      ['g s', 'stack'],
      ['g w', 'work'],
      ['g t', 'timeline'],
      ['g e', 'education'],
      ['g a', 'proof'],
      ['g p', 'products'],
      ['g f', 'faq'],
      ['g c', 'contact'],
    ]);
  });

  it('filters case-insensitively across labels and keywords', () => {
    const actions = createCommandPaletteActions(config);

    expect(filterCommandPaletteActions(actions, 'PROOF').map((item) => item.label)).toEqual([
      'Accolades',
    ]);
    expect(filterCommandPaletteActions(actions, 'accolades').map((item) => item.label)).toEqual([
      'Accolades',
    ]);
    expect(filterCommandPaletteActions(actions, 'cv').map((item) => item.label)).toEqual([
      'Download resume',
    ]);
    expect(filterCommandPaletteActions(actions, '  social  ').map((item) => item.label)).toEqual([
      'LinkedIn',
    ]);
  });

  it('wraps ArrowDown and ArrowUp selection', () => {
    const actionCount = createCommandPaletteActions(config).length;
    expect(moveCommandPaletteSelection(actionCount - 1, 'ArrowDown', actionCount)).toBe(0);
    expect(moveCommandPaletteSelection(0, 'ArrowUp', actionCount)).toBe(actionCount - 1);
    expect(moveCommandPaletteSelection(4, 'ArrowDown', actionCount)).toBe(5);
  });

  it('keeps the Accolades action on the stable proof anchor', () => {
    expect(action('Accolades')).toMatchObject({ kind: 'section', targetId: 'proof' });
  });

  it('keeps a keyboard-selected option visible inside the scrolling list', () => {
    const scrollIntoView = vi.fn();
    const findOption = vi.fn(() => ({ scrollIntoView }));

    keepCommandPaletteSelectionVisible('source', findOption);

    expect(findOption).toHaveBeenCalledWith('command-palette-option-source');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });
});

describe('command palette activation', () => {
  it('activates a section through injected scrolling and hash seams', async () => {
    const scrollIntoView = vi.fn();
    const updateHash = vi.fn();
    const close = vi.fn();

    await activateCommandPaletteAction(action('Selected work'), {
      close,
      copyText: vi.fn(),
      dispatchTerminalOpen: vi.fn(),
      findSection: (id) => (id === 'work' ? { scrollIntoView } : null),
      navigate: vi.fn(),
      reducedMotion: false,
      setTheme: vi.fn(),
      updateHash,
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(updateHash).toHaveBeenCalledWith('#work');
    expect(close).toHaveBeenCalledOnce();
  });

  it('uses instant section scrolling when reduced motion is requested', async () => {
    const scrollIntoView = vi.fn();

    await activateCommandPaletteAction(action('Contact'), {
      close: vi.fn(),
      copyText: vi.fn(),
      dispatchTerminalOpen: vi.fn(),
      findSection: () => ({ scrollIntoView }),
      navigate: vi.fn(),
      reducedMotion: true,
      setTheme: vi.fn(),
      updateHash: vi.fn(),
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('dispatches the existing terminal event', async () => {
    const dispatchTerminalOpen = vi.fn();
    const close = vi.fn();

    await activateCommandPaletteAction(action('Open terminal'), {
      close,
      copyText: vi.fn(),
      dispatchTerminalOpen,
      findSection: vi.fn(),
      navigate: vi.fn(),
      reducedMotion: false,
      setTheme: vi.fn(),
      updateHash: vi.fn(),
    });

    expect(close).toHaveBeenCalledWith(false);
    expect(dispatchTerminalOpen).toHaveBeenCalledOnce();
  });

  it('copies the public email', async () => {
    const copyText = vi.fn().mockResolvedValue(undefined);

    await activateCommandPaletteAction(action('Copy email'), {
      close: vi.fn(),
      copyText,
      dispatchTerminalOpen: vi.fn(),
      findSection: vi.fn(),
      navigate: vi.fn(),
      reducedMotion: false,
      setTheme: vi.fn(),
      updateHash: vi.fn(),
    });

    expect(copyText).toHaveBeenCalledWith(config.email);
  });

  it.each([
    ['Light theme', 'light'],
    ['Dark theme', 'dark'],
  ])('sets the explicit %s command through next-themes', async (label, theme) => {
    const setTheme = vi.fn();

    await activateCommandPaletteAction(action(label), {
      close: vi.fn(),
      copyText: vi.fn(),
      dispatchTerminalOpen: vi.fn(),
      findSection: vi.fn(),
      navigate: vi.fn(),
      reducedMotion: false,
      setTheme,
      updateHash: vi.fn(),
    });

    expect(setTheme).toHaveBeenCalledWith(theme);
  });

  it.each(['Download resume', 'GitHub'])(
    'restores focus after activating the %s link',
    async (label) => {
      const close = vi.fn();

      await activateCommandPaletteAction(action(label), {
        close,
        copyText: vi.fn(),
        dispatchTerminalOpen: vi.fn(),
        findSection: vi.fn(),
        navigate: vi.fn(),
        reducedMotion: false,
        setTheme: vi.fn(),
        updateHash: vi.fn(),
      });

      expect(close).toHaveBeenCalledWith();
      expect(close).not.toHaveBeenCalledWith(false);
    },
  );
});

describe('command palette keyboard and focus lifecycle', () => {
  it('activates the selected section on Enter through navigation seams', async () => {
    const scrollIntoView = vi.fn();
    const updateHash = vi.fn();
    const preventDefault = vi.fn();
    const actions = createCommandPaletteActions(config);
    const selectedIndex = actions.findIndex((item) => item.label === 'Education');

    await handleCommandPaletteInputKey(
      { key: 'Enter', preventDefault, shiftKey: false },
      actions,
      selectedIndex,
      {
        activate: (selectedAction) => activateCommandPaletteAction(selectedAction, {
          close: vi.fn(),
          copyText: vi.fn(),
          dispatchTerminalOpen: vi.fn(),
          findSection: () => ({ scrollIntoView }),
          navigate: vi.fn(),
          reducedMotion: false,
          setTheme: vi.fn(),
          updateHash,
        }),
        setSelectedIndex: vi.fn(),
      },
    );

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(updateHash).toHaveBeenCalledWith('#education');
  });

  it('closes on dialog Escape and restores focus to the actual opener', async () => {
    const focus = vi.fn();
    const openerRef = {
      current: { isConnected: true, focus },
    };
    const setOpen = vi.fn();

    const preventDefault = vi.fn();

    handleCommandPaletteDialogKey(
      { key: 'Escape', preventDefault, shiftKey: false },
      {
        close: () => closeCommandPalette(openerRef, setOpen),
        trapTab: vi.fn(),
      },
    );

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(openerRef.current).toBeNull();
  });

  it('does not intercept Enter bubbled from a focused dialog control', () => {
    const preventDefault = vi.fn();
    const close = vi.fn();
    const trapTab = vi.fn();

    handleCommandPaletteDialogKey(
      { key: 'Enter', preventDefault, shiftKey: false },
      { close, trapTab },
    );

    expect(preventDefault).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(trapTab).not.toHaveBeenCalled();
  });

  it('wraps Tab and Shift+Tab focus within the dialog', () => {
    const first = { focus: vi.fn() };
    const last = { focus: vi.fn() };
    const dialog = {
      querySelectorAll: () => [first, last],
    } as unknown as HTMLDivElement;
    const forwardPreventDefault = vi.fn();
    const backwardPreventDefault = vi.fn();

    trapCommandPaletteTab(
      { key: 'Tab', shiftKey: false, preventDefault: forwardPreventDefault },
      dialog,
      last as unknown as Element,
    );
    trapCommandPaletteTab(
      { key: 'Tab', shiftKey: true, preventDefault: backwardPreventDefault },
      dialog,
      first as unknown as Element,
    );

    expect(forwardPreventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();
    expect(backwardPreventDefault).toHaveBeenCalledOnce();
    expect(last.focus).toHaveBeenCalledOnce();
  });

  it('handles Ctrl+K, Cmd+K, and the custom open event with their actual openers', () => {
    const listeners = new Map<string, (event: Record<string, unknown>) => void>();
    const target = {
      addEventListener(type: string, listener: (event: Record<string, unknown>) => void) {
        listeners.set(type, listener);
      },
      removeEventListener(type: string, listener: (event: Record<string, unknown>) => void) {
        if (listeners.get(type) === listener) listeners.delete(type);
      },
    };
    const activeElement = { focus: vi.fn() };
    const button = { focus: vi.fn() };
    const open = vi.fn();
    const cleanup = listenForPaletteOpen(target, () => activeElement, open);
    const ctrlPreventDefault = vi.fn();
    const metaPreventDefault = vi.fn();

    listeners.get('keydown')?.({ key: 'k', ctrlKey: true, metaKey: false, preventDefault: ctrlPreventDefault });
    listeners.get('keydown')?.({ key: 'K', ctrlKey: false, metaKey: true, preventDefault: metaPreventDefault });
    listeners.get(COMMAND_PALETTE_OPEN_EVENT)?.({ detail: button });

    expect(ctrlPreventDefault).toHaveBeenCalledOnce();
    expect(metaPreventDefault).toHaveBeenCalledOnce();
    expect(open.mock.calls).toEqual([[activeElement], [activeElement], [button]]);

    cleanup();
    expect(listeners.size).toBe(0);
  });

  it('replays a header click made before the palette listener mounts exactly once', () => {
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
    const trigger = {
      closest(selector: string) {
        return selector === '[data-command-palette-trigger]' ? this : null;
      },
    };
    const activeElement = { focus: vi.fn() };
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
      { detail: trigger, eventType: COMMAND_PALETTE_OPEN_EVENT },
    ]);

    const cleanup = listenForPaletteOpen(runtime, () => activeElement, open);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenLastCalledWith(trigger);
    expect(runtime.__dossierPendingOpenRequests).toBeUndefined();

    navListeners.get('click')?.({ target: trigger });

    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith(trigger);
    expect(runtime.__dossierPendingOpenRequests).toBeUndefined();

    cleanup();
  });

  it('imports once, preserves the first opener while open, and reuses the component', async () => {
    const firstOpener = { id: 'first' };
    const ignoredOpener = { id: 'ignored' };
    const reopenedOpener = { id: 'reopened' };
    const loadedComponent = { id: 'palette-component' };
    let resolveImport: ((component: typeof loadedComponent) => void) | undefined;
    const importer = vi.fn(
      () => new Promise<typeof loadedComponent>((resolve) => {
        resolveImport = resolve;
      }),
    );
    const present = vi.fn();
    const controller = createCommandPaletteLoadController(present);

    const firstOpen = controller.open(firstOpener, importer);
    const ignoredOpen = controller.open(ignoredOpener, importer);
    resolveImport?.(loadedComponent);
    await Promise.all([firstOpen, ignoredOpen]);

    expect(importer).toHaveBeenCalledOnce();
    expect(present).toHaveBeenCalledTimes(1);
    expect(present).toHaveBeenLastCalledWith(loadedComponent, firstOpener);

    controller.close();
    await controller.open(reopenedOpener, importer);

    expect(importer).toHaveBeenCalledOnce();
    expect(present).toHaveBeenCalledTimes(2);
    expect(present).toHaveBeenLastCalledWith(loadedComponent, reopenedOpener);
  });
});

describe('command palette markup', () => {
  it('focuses its input without scrolling and leaves the ring to focus-visible', () => {
    expect(commandPaletteSource).not.toMatch(/\bautoFocus\b/);
    expect(commandPaletteSource).toContain('.focus({ preventScroll: true })');
    expect(styles).toMatch(/:where\([^)]*input[^)]*\):focus-visible\s*\{/);
  });

  it('renders labelled dialog, listbox, options, active descendant, and safe links', () => {
    const markup = renderToStaticMarkup(
      createElement(CommandPalette, {
        ...config,
        onClose: vi.fn(),
        opener: null,
      }),
    );

    expect(markup).toMatch(/role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="command-palette-title"/);
    expect(markup).toMatch(/<input(?=[^>]*role="combobox")(?=[^>]*aria-controls="command-palette-listbox")(?=[^>]*aria-expanded="true")(?=[^>]*aria-autocomplete="list")(?=[^>]*aria-activedescendant="command-palette-option-)/);
    expect(markup).not.toContain('autofocus');
    expect(markup).toMatch(/role="listbox"/);
    expect(markup).not.toMatch(/role="listbox"[^>]*aria-activedescendant/);
    expect(markup.match(/role="option"/g)).toHaveLength(23);
    expect(markup).toMatch(/href="\/media\/resume\.pdf"[^>]*download=""/);
    expect(markup).toMatch(/href="\/zurielst\.vcf"[^>]*download=""/);
    expect(markup).toMatch(/href="\/llms\.txt"/);
    expect(markup).toMatch(/href="https:\/\/github\.com\/Leiruz"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    expect(markup).toContain('<kbd>g</kbd>');
    expect(markup).toContain('<kbd>i</kbd>');
    expect(markup).toContain('>ZST</span>');
    expect(markup).toContain('<kbd>Enter</kbd> Go to section');
  });
});
