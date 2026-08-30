'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { TERMINAL_OPEN_EVENT } from '@/components/footer';
import {
  drainPendingOpenRequests,
  takePendingOpenRequest,
  type PendingOpenRequestTarget,
} from '@/lib/pending-open-requests';
import { resolveTerminalCommand } from '@/lib/terminal-commands';

interface TerminalProps {
  commands: string[];
  source: string;
  email: string;
  gamesUrl: string;
  resumeAvailable: boolean;
}

interface TerminalLine {
  id: number;
  command?: string;
  output: string;
}

interface FocusTarget {
  isConnected?: boolean;
  focus(options?: FocusOptions): void;
}

interface TerminalKeyTarget {
  addEventListener(type: 'keydown', listener: (event: globalThis.KeyboardEvent) => void): void;
  removeEventListener(type: 'keydown', listener: (event: globalThis.KeyboardEvent) => void): void;
}

interface TerminalOpenEvent {
  detail?: unknown;
  key?: string;
  preventDefault?(): void;
  target?: unknown;
}

interface TerminalOpenTarget extends PendingOpenRequestTarget {
  addEventListener(type: string, listener: (event: TerminalOpenEvent) => void): void;
  removeEventListener(type: string, listener: (event: TerminalOpenEvent) => void): void;
}

interface TerminalTabEvent {
  key: string;
  shiftKey: boolean;
  preventDefault(): void;
}

interface TerminalBackdropEvent {
  target: EventTarget | null;
  currentTarget: EventTarget | null;
}

export function closeTerminalDialog(
  isOpenRef: { current: boolean },
  restoreFocusRef: { current: FocusTarget | null },
  setIsOpen: (isOpen: boolean) => void,
) {
  if (!isOpenRef.current) return;

  isOpenRef.current = false;
  setIsOpen(false);
  const opener = restoreFocusRef.current;
  restoreFocusRef.current = null;
  if (opener?.isConnected !== false) opener?.focus({ preventScroll: true });
}

export function openTerminalDialog(
  isOpenRef: { current: boolean },
  restoreFocusRef: { current: FocusTarget | null },
  opener: FocusTarget | null,
  setIsOpen: (isOpen: boolean) => void,
) {
  if (isOpenRef.current) return;

  isOpenRef.current = true;
  restoreFocusRef.current = opener;
  setIsOpen(true);
}

export function listenForTerminalEscape(target: TerminalKeyTarget, close: () => void) {
  function onKeyDown(event: globalThis.KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  }

  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}

export function listenForTerminalOpen(
  target: TerminalOpenTarget,
  open: (opener?: unknown) => void,
) {
  for (const request of drainPendingOpenRequests(target, TERMINAL_OPEN_EVENT)) {
    open(request.detail);
  }

  function onOpenEvent(event: TerminalOpenEvent) {
    const pending = takePendingOpenRequest(target, TERMINAL_OPEN_EVENT);
    open(pending ? pending.detail : event.detail);
  }

  function onGlobalKeyDown(event: TerminalOpenEvent) {
    const eventTarget = event.target;
    const isEditable = eventTarget instanceof HTMLInputElement
      || eventTarget instanceof HTMLTextAreaElement
      || (eventTarget instanceof HTMLElement && eventTarget.isContentEditable);
    if (event.key === '`' && !isEditable) {
      event.preventDefault?.();
      open();
    }
  }

  target.addEventListener(TERMINAL_OPEN_EVENT, onOpenEvent);
  target.addEventListener('keydown', onGlobalKeyDown);
  return () => {
    target.removeEventListener(TERMINAL_OPEN_EVENT, onOpenEvent);
    target.removeEventListener('keydown', onGlobalKeyDown);
  };
}

export function trapTerminalTab(
  event: TerminalTabEvent,
  dialog: HTMLDivElement | null,
  activeElement: Element | null,
) {
  if (event.key !== 'Tab') return;

  const focusable = dialog?.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  );
  if (!focusable?.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

export function closeTerminalFromBackdrop(
  event: TerminalBackdropEvent,
  close: () => void,
) {
  if (event.target === event.currentTarget) close();
}

export function Terminal({ commands, source, email, gamesUrl, resumeAvailable }: TerminalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, output: 'Type help to list commands.' },
  ]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(false);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const lineIdRef = useRef(1);

  useEffect(() => {
    function open(eventOpener?: unknown) {
      const opener = eventOpener instanceof HTMLElement
        ? eventOpener
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      openTerminalDialog(isOpenRef, restoreFocusRef, opener, setIsOpen);
    }

    return listenForTerminalOpen(
      window as unknown as TerminalOpenTarget,
      open,
    );
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    return listenForTerminalEscape(document, close);
  }, [isOpen]);

  function close() {
    closeTerminalDialog(isOpenRef, restoreFocusRef, setIsOpen);
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    trapTerminalTab(event, dialogRef.current, document.activeElement);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const enteredCommand = input.trim();
    const action = resolveTerminalCommand(enteredCommand, {
      commands,
      email,
      resumeAvailable,
      gamesUrl,
    });
    setInput('');

    if (action.type === 'clear') {
      setLines([]);
      return;
    }
    if (action.type === 'scroll') {
      const target = document.getElementById(action.targetId);
      if (!target) {
        setLines((current) => [
          ...current,
          {
            id: lineIdRef.current++,
            command: enteredCommand,
            output: `section unavailable: ${action.targetId}. Try another command or return after the dossier is complete.`,
          },
        ]);
        return;
      }
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      close();
      return;
    }
    if (action.type === 'open') {
      const openedWindow = window.open(action.url, '_blank', 'noopener,noreferrer');
      if (openedWindow) openedWindow.opener = null;
      close();
      return;
    }

    setLines((current) => [
      ...current,
      { id: lineIdRef.current++, command: enteredCommand, output: action.text },
    ]);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={(event) => closeTerminalFromBackdrop(event, close)}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="terminal-title" onKeyDown={handleDialogKeyDown} className="w-full max-w-2xl overflow-hidden rounded-xl border border-line-strong bg-[#09090a] font-mono text-sm text-[#d0d6e0] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 id="terminal-title" className="font-medium text-[#f7f8f8]">zurielst.com terminal</h2>
            <p className="mt-1 text-xs text-[#8a8f98]">{source}</p>
          </div>
          <button type="button" onClick={close} aria-label="Close terminal" className="rounded-md px-3 py-2 text-lg leading-none text-[#8a8f98] transition-colors duration-150 hover:bg-white/10 hover:text-white">×</button>
        </div>
        <div className="max-h-[55vh] min-h-64 overflow-y-auto p-4" aria-live="polite">
          {lines.map((line) => (
            <div key={line.id} className="mb-3 break-words">
              {line.command !== undefined && <p className="text-[#8a8f98]">$ {line.command}</p>}
              <p className="whitespace-pre-wrap text-[#d0d6e0]">{line.output}</p>
            </div>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
          <label htmlFor="terminal-command" className="text-[#8a8f98]">$</label>
          <input autoFocus id="terminal-command" value={input} onChange={(event) => setInput(event.target.value)} autoComplete="off" spellCheck={false} className="min-w-0 flex-1 bg-transparent text-[#f7f8f8] outline-none placeholder:text-[#8a8f98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4b7bff]" placeholder="Type help" />
          <button type="submit" className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-[#d0d6e0] transition-colors duration-150 hover:bg-white/10 hover:text-white">Run</button>
        </form>
      </div>
    </div>
  );
}
