import { afterEach, describe, expect, it, vi } from 'vitest';

import * as sectionShortcutsModule from '@/lib/section-shortcuts';

interface ShortcutEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  preventDefault(): void;
  repeat: boolean;
  shiftKey: boolean;
  target: unknown;
}

type ShortcutListener = (event: ShortcutEvent) => void;

interface ShortcutRuntime {
  findSection(id: string): { scrollIntoView(options: ScrollIntoViewOptions): void } | null;
  isEditable(target: unknown): boolean;
  isModalOpen(): boolean;
  listen(listener: ShortcutListener): void;
  listenForModalOpen(listener: () => void): void;
  reducedMotion(): boolean;
  updateHash(hash: string): void;
}

type InstallGlobalSectionShortcuts = (
  targets: Readonly<Record<string, string>>,
  runtime: ShortcutRuntime,
) => void;

afterEach(() => {
  vi.unstubAllGlobals();
});

function keyEvent(
  key: string,
  overrides: Partial<ShortcutEvent> = {},
): ShortcutEvent {
  return {
    altKey: false,
    ctrlKey: false,
    key,
    metaKey: false,
    preventDefault: vi.fn(),
    repeat: false,
    shiftKey: false,
    target: null,
    ...overrides,
  };
}

function shortcutHarness() {
  const installGlobalSectionShortcuts = Reflect.get(
    sectionShortcutsModule,
    'installGlobalSectionShortcuts',
  ) as InstallGlobalSectionShortcuts | undefined;
  let listener: ShortcutListener | undefined;
  let resetPrefix: (() => void) | undefined;
  let modalOpen = false;
  const scrollIntoView = vi.fn();
  const updateHash = vi.fn();
  const runtime: ShortcutRuntime = {
    findSection: (id) => (id === 'work' ? { scrollIntoView } : null),
    isEditable: () => false,
    isModalOpen: () => modalOpen,
    listen: (nextListener) => {
      listener = nextListener;
    },
    listenForModalOpen: (listener) => {
      resetPrefix = listener;
    },
    reducedMotion: () => false,
    updateHash,
  };

  expect(installGlobalSectionShortcuts).toBeTypeOf('function');
  installGlobalSectionShortcuts?.({ w: 'work' }, runtime);

  return {
    dispatch(event: ShortcutEvent) {
      listener?.(event);
    },
    scrollIntoView,
    signalModalOpen() {
      resetPrefix?.();
    },
    setModalOpen(open: boolean) {
      modalOpen = open;
    },
    updateHash,
  };
}

describe('global section shortcuts', () => {
  it('ignores g navigation while the command palette is open', () => {
    const harness = shortcutHarness();
    harness.setModalOpen(true);

    harness.dispatch(keyEvent('g'));
    harness.setModalOpen(false);
    harness.dispatch(keyEvent('w'));

    expect(harness.scrollIntoView).not.toHaveBeenCalled();
    expect(harness.updateHash).not.toHaveBeenCalled();
  });

  it('resets an armed prefix when a modal opens', () => {
    const harness = shortcutHarness();

    harness.dispatch(keyEvent('g'));
    harness.setModalOpen(true);
    harness.signalModalOpen();
    harness.setModalOpen(false);
    harness.signalModalOpen();
    harness.dispatch(keyEvent('w'));

    expect(harness.scrollIntoView).not.toHaveBeenCalled();
    expect(harness.updateHash).not.toHaveBeenCalled();
  });

  it.each(['ctrlKey', 'altKey', 'metaKey', 'shiftKey', 'repeat'] as const)(
    'does not arm g navigation when %s is set',
    (guard) => {
      const harness = shortcutHarness();

      harness.dispatch(keyEvent('g', { [guard]: true }));
      harness.dispatch(keyEvent('w'));

      expect(harness.scrollIntoView).not.toHaveBeenCalled();
      expect(harness.updateHash).not.toHaveBeenCalled();
    },
  );

  it('resets the prefix when the floating chat launcher is activated', () => {
    const installGlobalSectionShortcuts = Reflect.get(
      sectionShortcutsModule,
      'installGlobalSectionShortcuts',
    ) as ((targets: Readonly<Record<string, string>>) => void) | undefined;
    const windowListeners = new Map<string, Array<(event: ShortcutEvent) => void>>();
    const documentListeners = new Map<string, (event: { target: unknown }) => void>();
    const scrollIntoView = vi.fn();
    const updateHash = vi.fn();
    let modalOpen = false;
    let syncModalState: (() => void) | undefined;
    class TestElement {
      closest(selector: string) {
        return selector === '.chat-launcher' ? this : null;
      }
    }
    class TestInputElement {}

    vi.stubGlobal('Element', TestElement);
    vi.stubGlobal('HTMLElement', class {});
    vi.stubGlobal('HTMLInputElement', TestInputElement);
    vi.stubGlobal('HTMLTextAreaElement', class {});
    vi.stubGlobal('document', {
      addEventListener(type: string, listener: (event: { target: unknown }) => void) {
        documentListeners.set(type, listener);
      },
      documentElement: { dataset: { intro: 'done' } },
      getElementById: (id: string) => id === 'work' ? { scrollIntoView } : null,
      querySelector: () => modalOpen ? {} : null,
    });
    vi.stubGlobal('MutationObserver', class {
      constructor(listener: () => void) {
        syncModalState = listener;
      }

      observe() {}
    });
    vi.stubGlobal('window', {
      addEventListener(type: string, listener: (event: ShortcutEvent) => void) {
        const listeners = windowListeners.get(type) ?? [];
        listeners.push(listener);
        windowListeners.set(type, listeners);
      },
      history: { pushState: updateHash },
      matchMedia: () => ({ matches: false }),
    });

    expect(installGlobalSectionShortcuts).toBeTypeOf('function');
    installGlobalSectionShortcuts?.({ w: 'work' });
    const dispatchKey = (event: ShortcutEvent) => {
      for (const listener of windowListeners.get('keydown') ?? []) listener(event);
    };
    expect(windowListeners.get('keydown')).not.toHaveLength(0);

    documentListeners.get('click')?.({ target: new TestElement() });
    dispatchKey(keyEvent('g'));
    modalOpen = true;
    syncModalState?.();
    modalOpen = false;
    syncModalState?.();
    dispatchKey(keyEvent('w'));

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(updateHash).not.toHaveBeenCalled();

    dispatchKey(keyEvent('g'));
    const navigationEvent = keyEvent('w');
    dispatchKey(navigationEvent);
    expect(navigationEvent.preventDefault).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(updateHash).toHaveBeenCalledWith(null, '', '#work');

    for (const listener of windowListeners.get('dossier:command-palette-open') ?? []) {
      listener(keyEvent(''));
    }
    dispatchKey(keyEvent('`', { target: new TestInputElement() }));
    dispatchKey(keyEvent('g'));
    dispatchKey(keyEvent('w'));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
