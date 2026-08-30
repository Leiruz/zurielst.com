'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';

import type { CommandPaletteConfig } from '@/lib/command-palette';

export const COMMAND_PALETTE_OPEN_EVENT = 'dossier:command-palette-open';

interface PaletteOpenEvent {
  ctrlKey?: boolean;
  detail?: unknown;
  key?: string;
  metaKey?: boolean;
  preventDefault?(): void;
}

interface PaletteEventTarget {
  addEventListener(type: string, listener: (event: PaletteOpenEvent) => void): void;
  removeEventListener(type: string, listener: (event: PaletteOpenEvent) => void): void;
}

interface FocusTarget {
  focus(options?: FocusOptions): void;
  isConnected?: boolean;
}

export function closeCommandPalette(
  openerRef: { current: FocusTarget | null },
  setOpen: (open: false) => void,
  restoreFocus = true,
) {
  setOpen(false);
  const opener = openerRef.current;
  openerRef.current = null;
  if (restoreFocus && opener?.isConnected !== false) {
    opener?.focus({ preventScroll: true });
  }
}

interface CommandPaletteProps extends CommandPaletteConfig {
  onClose(restoreFocus?: boolean): void;
  opener: HTMLElement | null;
}

export function createCommandPaletteLoadController<Component, Opener>(
  present: (component: Component, opener: Opener) => void,
) {
  let loadedComponent: Component | null = null;
  let importPromise: Promise<Component> | null = null;
  let isOpen = false;

  return {
    async open(opener: Opener, importer: () => Promise<Component>) {
      if (isOpen || importPromise) return;

      if (loadedComponent) {
        isOpen = true;
        present(loadedComponent, opener);
        return;
      }

      importPromise = importer();
      try {
        loadedComponent = await importPromise;
        isOpen = true;
        present(loadedComponent, opener);
      } finally {
        importPromise = null;
      }
    },
    close() {
      isOpen = false;
    },
  };
}

export function listenForPaletteOpen(
  target: PaletteEventTarget,
  getActiveElement: () => FocusTarget | null,
  open: (opener: FocusTarget | null) => void,
) {
  function onKeyDown(event: PaletteOpenEvent) {
    if (event.key?.toLowerCase() !== 'k' || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault?.();
    open(getActiveElement());
  }

  function onOpenEvent(event: PaletteOpenEvent) {
    open((event.detail as FocusTarget | null) ?? getActiveElement());
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent);
  };
}

export function CommandPaletteLoader(config: CommandPaletteConfig) {
  const [LoadedPalette, setLoadedPalette] = useState<ComponentType<CommandPaletteProps> | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const [loadController] = useState(() =>
    createCommandPaletteLoadController<ComponentType<CommandPaletteProps>, FocusTarget | null>(
      (palette, opener) => {
        openerRef.current = opener instanceof HTMLElement ? opener : null;
        setLoadedPalette(() => palette);
        setIsOpen(true);
      },
    ),
  );

  async function openCommandPalette(opener: FocusTarget | null) {
    await loadController.open(opener, async () => {
      const paletteModule = await import('@/components/command-palette');
      return paletteModule.CommandPalette;
    });
  }

  useEffect(
    () =>
      listenForPaletteOpen(
        window as unknown as PaletteEventTarget,
        () => document.activeElement instanceof HTMLElement ? document.activeElement : null,
        openCommandPalette,
      ),
    [],
  );

  function close(restoreFocus = true) {
    loadController.close();
    closeCommandPalette(openerRef, () => setIsOpen(false), restoreFocus);
  }

  if (!LoadedPalette || !isOpen) return null;

  return <LoadedPalette {...config} onClose={close} opener={openerRef.current} />;
}
