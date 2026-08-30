'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Profile } from '@/content/schema';
import { TERMINAL_OPEN_EVENT } from '@/components/footer';
import { resolveTerminalCommand } from '@/lib/terminal-commands';

interface TerminalProps {
  profile: Profile;
  resumeAvailable: boolean;
}

interface TerminalLine {
  id: number;
  command?: string;
  output: string;
}

export function Terminal({ profile, resumeAvailable }: TerminalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, output: profile.easter_eggs.terminal.note },
  ]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpenRef = useRef(false);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const lineIdRef = useRef(1);

  useEffect(() => {
    function open() {
      if (isOpenRef.current) return;
      isOpenRef.current = true;
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setIsOpen(true);
    }

    function onGlobalKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target;
      const isEditable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable);
      if (event.key === '`' && !isEditable) {
        event.preventDefault();
        open();
      }
    }

    window.addEventListener(TERMINAL_OPEN_EVENT, open);
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => {
      window.removeEventListener(TERMINAL_OPEN_EVENT, open);
      window.removeEventListener('keydown', onGlobalKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const animationFrame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(animationFrame);
  }, [isOpen]);

  function close() {
    if (!isOpenRef.current) return;
    isOpenRef.current = false;
    setIsOpen(false);
    restoreFocusRef.current?.focus({ preventScroll: true });
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const enteredCommand = input.trim();
    const action = resolveTerminalCommand(enteredCommand, {
      commands: profile.easter_eggs.terminal.commands,
      email: profile.identity.email,
      resumeAvailable,
      gamesUrl: profile.easter_eggs.towerblock.url,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="terminal-title" onKeyDown={handleDialogKeyDown} className="w-full max-w-2xl overflow-hidden rounded-xl border border-line-strong bg-[#09090a] font-mono text-sm text-[#d0d6e0] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 id="terminal-title" className="font-medium text-[#f7f8f8]">zurielst.com terminal</h2>
            <p className="mt-1 text-xs text-[#8a8f98]">{profile.easter_eggs.terminal.source}</p>
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
          <input ref={inputRef} id="terminal-command" value={input} onChange={(event) => setInput(event.target.value)} autoComplete="off" spellCheck={false} className="min-w-0 flex-1 bg-transparent text-[#f7f8f8] outline-none placeholder:text-[#8a8f98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4b7bff]" placeholder="Type help" />
          <button type="submit" className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-[#d0d6e0] transition-colors duration-150 hover:bg-white/10 hover:text-white">Run</button>
        </form>
      </div>
    </div>
  );
}
