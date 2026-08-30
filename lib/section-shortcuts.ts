export const GLOBAL_SECTION_SHORTCUTS = {
  i: 'identity',
  w: 'work',
  s: 'stack',
  t: 'timeline',
  e: 'education',
  a: 'proof',
  p: 'products',
  f: 'faq',
  c: 'contact',
} as const;

interface SectionShortcutKeyEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  preventDefault(): void;
  repeat: boolean;
  shiftKey: boolean;
  target: unknown;
}

interface SectionShortcutRuntime {
  findSection(id: string): { scrollIntoView(options: ScrollIntoViewOptions): void } | null;
  isEditable(target: unknown): boolean;
  isModalOpen(): boolean;
  listen(listener: (event: SectionShortcutKeyEvent) => void): void;
  listenForModalOpen(listener: () => void): void;
  reducedMotion(): boolean;
  updateHash(hash: string): void;
}

export function installGlobalSectionShortcuts(
  targets: Readonly<Record<string, string>>,
  runtime?: SectionShortcutRuntime,
) {
  const browserRuntime = runtime ?? {
    findSection: (id: string) => document.getElementById(id),
    isEditable: (target: unknown) => target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || (target instanceof HTMLElement && target.isContentEditable),
    isModalOpen: () => document.documentElement.dataset.intro !== 'done'
      || document.querySelector(
        '[role="dialog"][aria-modal="true"], #dossier-chat-dialog[data-state="open"]',
      ) !== null,
    listen: (listener: (event: SectionShortcutKeyEvent) => void) => {
      window.addEventListener('keydown', listener as (event: KeyboardEvent) => void);
    },
    listenForModalOpen: (listener: () => void) => {
      const modalIsOpen = () => document.documentElement.dataset.intro !== 'done'
        || document.querySelector(
          '[role="dialog"][aria-modal="true"], #dossier-chat-dialog[data-state="open"]',
        ) !== null;
      let wasOpen = modalIsOpen();
      const syncOpenState = () => {
        const open = modalIsOpen();
        if (open === wasOpen) return;
        wasOpen = open;
        listener();
      };
      for (const eventName of [
        'dossier:chat-open',
        'dossier:command-palette-open',
        'dossier:terminal-open',
      ]) {
        window.addEventListener(eventName, listener);
      }
      document.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('.chat-launcher')) {
          listener();
        }
      });
      new MutationObserver(syncOpenState).observe(document.documentElement, {
        attributeFilter: ['aria-modal', 'data-intro', 'data-state'],
        attributes: true,
        childList: true,
        subtree: true,
      });
    },
    reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    updateHash: (hash: string) => window.history.pushState(null, '', hash),
  };
  let goPrefix = false;

  browserRuntime.listenForModalOpen(() => {
    goPrefix = false;
  });
  browserRuntime.listen((event) => {
    const key = event.key.toLowerCase();
    if (
      browserRuntime.isModalOpen()
      || browserRuntime.isEditable(event.target)
      || event.ctrlKey
      || event.altKey
      || event.metaKey
      || event.shiftKey
      || event.repeat
    ) {
      goPrefix = false;
      return;
    }
    if (key === 'g') {
      goPrefix = true;
      return;
    }
    if (!goPrefix) return;

    goPrefix = false;
    const targetId = targets[key];
    const section = targetId ? browserRuntime.findSection(targetId) : null;
    if (!section) return;

    event.preventDefault();
    section.scrollIntoView({
      behavior: browserRuntime.reducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
    browserRuntime.updateHash(`#${targetId}`);
  });
}
