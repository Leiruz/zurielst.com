'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useTheme } from 'next-themes';

import { TERMINAL_OPEN_EVENT } from '@/lib/terminal-events';
import {
  activateCommandPaletteAction,
  createCommandPaletteActions,
  filterCommandPaletteActions,
  handleCommandPaletteDialogKey,
  handleCommandPaletteInputKey,
  keepCommandPaletteSelectionVisible,
  trapCommandPaletteTab,
  type CommandPaletteAction,
  type CommandPaletteConfig,
  type CommandPaletteGroup,
} from '@/lib/command-palette';

interface CommandPaletteProps extends CommandPaletteConfig {
  onClose(restoreFocus?: boolean): void;
  opener: HTMLElement | null;
}

const GROUPS: readonly CommandPaletteGroup[] = ['Sections', 'Actions', 'Links'];

function focusInput(input: HTMLInputElement | null) {
  input?.focus({ preventScroll: true });
}

function navigate(action: Extract<CommandPaletteAction, { kind: 'link' }>) {
  if (action.download) {
    const anchor = document.createElement('a');
    anchor.href = action.href;
    anchor.download = '';
    anchor.click();
    return;
  }

  if (action.external) {
    const openedWindow = window.open(action.href, '_blank', 'noopener,noreferrer');
    if (openedWindow) openedWindow.opener = null;
    return;
  }

  window.location.assign(action.href);
}

export function CommandPalette({
  email,
  githubUrl,
  linkedInUrl,
  onClose,
  opener,
  sourceUrl,
}: CommandPaletteProps) {
  const { setTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const actions = useMemo(
    () => createCommandPaletteActions({ email, githubUrl, linkedInUrl, sourceUrl }),
    [email, githubUrl, linkedInUrl, sourceUrl],
  );
  const filteredActions = filterCommandPaletteActions(actions, query);
  const activeAction = filteredActions[selectedIndex] ?? filteredActions[0];

  useEffect(() => {
    keepCommandPaletteSelectionVisible(
      activeAction?.id,
      (id) => document.getElementById(id),
    );
  }, [activeAction?.id]);

  async function activate(action: CommandPaletteAction) {
    await activateCommandPaletteAction(action, {
      close: onClose,
      copyText: (text) => navigator.clipboard.writeText(text),
      dispatchTerminalOpen: () =>
        window.dispatchEvent(new CustomEvent(TERMINAL_OPEN_EVENT, { detail: opener })),
      findSection: (id) => document.getElementById(id),
      navigate,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      setTheme,
      updateHash: (hash) => window.history.pushState(null, '', hash),
    });
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    void handleCommandPaletteInputKey(event, filteredActions, selectedIndex, {
      activate,
      setSelectedIndex,
    });
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    handleCommandPaletteDialogKey(event, {
      close: onClose,
      trapTab: () =>
        trapCommandPaletteTab(event, dialogRef.current, document.activeElement),
    });
  }

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 p-4 pt-[min(18vh,9rem)] backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none"
      onClick={closeFromBackdrop}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-line-strong bg-surface shadow-2xl transition-transform duration-150 motion-reduce:transition-none"
      >
        <h2 id="command-palette-title" className="sr-only">Command palette</h2>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <span aria-hidden="true" className="font-mono text-sm text-text-3">/</span>
          <input
            ref={focusInput}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            aria-controls="command-palette-listbox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-activedescendant={activeAction ? `command-palette-option-${activeAction.id}` : undefined}
            aria-label="Filter commands"
            role="combobox"
            onKeyDown={handleInputKeyDown}
            className="min-w-0 flex-1 bg-transparent py-4 text-sm text-text-1 outline-none placeholder:text-text-3"
            placeholder="Type a command or section"
          />
          <button
            type="button"
            onClick={() => onClose()}
            className="rounded border border-line px-2 py-1 font-mono text-[0.65rem] text-text-3 transition-colors duration-150 hover:text-text-1 motion-reduce:transition-none"
            aria-label="Close command palette"
          >
            Esc
          </button>
        </div>

        <div
          id="command-palette-listbox"
          role="listbox"
          aria-label="Commands"
          className="max-h-[min(60vh,30rem)] overflow-y-auto p-2"
        >
          {filteredActions.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-text-3">No matching commands.</p>
          )}
          {GROUPS.map((group) => {
            const groupActions = filteredActions.filter((item) => item.group === group);
            if (groupActions.length === 0) return null;

            return (
              <div key={group} role="group" aria-labelledby={`command-palette-group-${group.toLowerCase()}`}>
                <p id={`command-palette-group-${group.toLowerCase()}`} className="px-3 pb-1 pt-3 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-text-3">
                  {group}
                </p>
                {groupActions.map((action) => {
                  const index = filteredActions.indexOf(action);
                  const isSelected = action === activeAction;
                  const optionClasses = 'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-text-2 transition-colors duration-150 hover:bg-surface-hover hover:text-text-1 aria-selected:bg-surface-hover aria-selected:text-text-1 motion-reduce:transition-none';
                  const optionProps = {
                    id: `command-palette-option-${action.id}`,
                    role: 'option',
                    'aria-selected': isSelected,
                    onMouseEnter: () => setSelectedIndex(index),
                  } as const;

                  if (action.kind === 'link') {
                    return (
                      <a
                        key={action.id}
                        {...optionProps}
                        href={action.href}
                        download={action.download ? '' : undefined}
                        target={action.external ? '_blank' : undefined}
                        rel={action.external ? 'noopener noreferrer' : undefined}
                        onClick={() => onClose()}
                        className={optionClasses}
                      >
                        <span>{action.label}</span>
                        <span aria-hidden="true" className="font-mono text-xs text-text-3">{action.external ? '↗' : '↵'}</span>
                      </a>
                    );
                  }

                  return (
                    <button
                      key={action.id}
                      {...optionProps}
                      type="button"
                      onClick={() => void activate(action)}
                      className={optionClasses}
                    >
                      <span>{action.label}</span>
                      {action.shortcut ? (
                        <span aria-hidden="true" className="flex gap-1 font-mono text-[0.65rem] text-text-3">
                          {action.shortcut.map((key) => <kbd key={key}>{key}</kbd>)}
                        </span>
                      ) : (
                        <span aria-hidden="true" className="font-mono text-xs text-text-3">↵</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-2 font-mono text-[0.65rem] text-text-3">
          <span className="font-semibold tracking-[0.16em] text-text-1">ZST</span>
          <span><kbd>Enter</kbd> Go to section</span>
        </div>
      </div>
    </div>
  );
}
