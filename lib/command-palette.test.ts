import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommandPalette } from '@/components/command-palette';
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
  it('exposes exactly 17 actions in the required groups and page order', () => {
    const actions = createCommandPaletteActions(config);

    expect(actions).toHaveLength(17);
    expect(actions.map((item) => item.group)).toEqual([
      ...Array<string>(10).fill('Sections'),
      ...Array<string>(4).fill('Actions'),
      ...Array<string>(3).fill('Links'),
    ]);
    expect(actions.slice(0, 10).map((item) => item.label)).toEqual([
      'Identity',
      'Contributions',
      'Capabilities',
      'Selected work',
      'Timeline',
      'Education',
      'Proof wall',
      'Products',
      'FAQ',
      'Contact',
    ]);
    expect(actions.slice(10).map((item) => item.label)).toEqual([
      'Download resume',
      'Open terminal',
      'Toggle theme',
      'Copy email',
      'GitHub',
      'LinkedIn',
      'View source',
    ]);
  });

  it('gives the resume action its public href and download semantics', () => {
    expect(action('Download resume')).toMatchObject({
      href: '/media/resume.pdf',
      download: true,
    });
  });

  it('filters case-insensitively across labels and keywords', () => {
    const actions = createCommandPaletteActions(config);

    expect(filterCommandPaletteActions(actions, 'PROOF').map((item) => item.label)).toEqual([
      'Proof wall',
    ]);
    expect(filterCommandPaletteActions(actions, 'cv').map((item) => item.label)).toEqual([
      'Download resume',
    ]);
    expect(filterCommandPaletteActions(actions, '  social  ').map((item) => item.label)).toEqual([
      'LinkedIn',
    ]);
  });

  it('wraps ArrowDown and ArrowUp selection', () => {
    expect(moveCommandPaletteSelection(16, 'ArrowDown', 17)).toBe(0);
    expect(moveCommandPaletteSelection(0, 'ArrowUp', 17)).toBe(16);
    expect(moveCommandPaletteSelection(4, 'ArrowDown', 17)).toBe(5);
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
      resolvedTheme: 'light',
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
      resolvedTheme: 'light',
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
      resolvedTheme: 'light',
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
      resolvedTheme: 'light',
      setTheme: vi.fn(),
      updateHash: vi.fn(),
    });

    expect(copyText).toHaveBeenCalledWith(config.email);
  });

  it('toggles the resolved theme through next-themes setTheme', async () => {
    const setTheme = vi.fn();

    await activateCommandPaletteAction(action('Toggle theme'), {
      close: vi.fn(),
      copyText: vi.fn(),
      dispatchTerminalOpen: vi.fn(),
      findSection: vi.fn(),
      navigate: vi.fn(),
      reducedMotion: false,
      resolvedTheme: 'dark',
      setTheme,
      updateHash: vi.fn(),
    });

    expect(setTheme).toHaveBeenCalledWith('light');
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
        resolvedTheme: 'light',
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
          resolvedTheme: 'light',
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
    expect(markup).toMatch(/role="listbox"/);
    expect(markup).not.toMatch(/role="listbox"[^>]*aria-activedescendant/);
    expect(markup.match(/role="option"/g)).toHaveLength(17);
    expect(markup).toMatch(/href="\/media\/resume\.pdf"[^>]*download=""/);
    expect(markup).toMatch(/href="https:\/\/github\.com\/Leiruz"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  });
});
