'use client';

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import type { ChatProps } from '@/components/chat/chat';
import type { ChatFocusTarget } from '@/components/chat/chat-store';
import { usePrefersReducedMotion } from '@/components/dossier/use-prefers-reduced-motion';

type ChatPanelComponent = ComponentType<ChatProps>;
type ChatPanelLoadState = boolean | null;

interface ChatLauncherProps {
  open: boolean;
  reducedMotion?: boolean;
  onToggle(trigger: ChatFocusTarget): void;
}

interface ChatPanelLoadStatusProps {
  failed: ChatPanelLoadState;
  onRetry(): void;
}

interface ChatAssistantProps {
  intentChips: string[];
  disclaimer: string;
  reducedMotion?: boolean;
}

interface ChatAssistantOpenEvent {
  detail?: ChatFocusTarget;
}

interface ChatAssistantOpenEventTarget {
  __dossierChatOpener?: ChatFocusTarget;
  addEventListener(
    type: string,
    listener: (event: ChatAssistantOpenEvent) => void,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: ChatAssistantOpenEvent) => void,
  ): void;
}

const CHAT_ASSISTANT_OPEN_EVENT = 'dossier:chat-open';

export function updateChatAssistantState(
  openerRef: { current: ChatFocusTarget | null },
  setOpen: (open: boolean) => void,
  nextOpener: ChatFocusTarget | null,
) {
  const previousOpener = openerRef.current;
  openerRef.current = nextOpener;
  setOpen(nextOpener !== null);
  if (nextOpener === null && previousOpener?.isConnected !== false) {
    previousOpener?.focus({ preventScroll: true });
  }
}

export function listenForChatAssistantOpen(
  target: ChatAssistantOpenEventTarget,
  open: (opener: ChatFocusTarget) => void,
) {
  function onOpen(event: ChatAssistantOpenEvent = {}) {
    const opener = event.detail ?? target.__dossierChatOpener;
    delete target.__dossierChatOpener;
    if (opener) open(opener);
  }

  onOpen();
  target.addEventListener(CHAT_ASSISTANT_OPEN_EVENT, onOpen);
  return () => target.removeEventListener(CHAT_ASSISTANT_OPEN_EVENT, onOpen);
}

export function ChatLauncher({
  open,
  reducedMotion,
  onToggle,
}: ChatLauncherProps) {
  return (
    <button
      type="button"
      aria-label={open ? 'Close the assistant' : 'Open the assistant'}
      aria-haspopup="dialog"
      aria-controls="dossier-chat-dialog"
      aria-expanded={open}
      onClick={(event) => onToggle(event.currentTarget)}
      className={`chat-launcher chat-control${reducedMotion ? '' : ' chat-control-motion'}`}
    >
      <svg
        data-chat-icon={open ? 'close' : 'terminal'}
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="chat-glyph"
      >
        <path d={open ? 'M6 6l12 12M18 6 6 18' : 'm5 7 5 5-5 5m7 0h7'} />
      </svg>
    </button>
  );
}

export function ChatPanelLoadStatus({
  failed,
  onRetry,
}: ChatPanelLoadStatusProps) {
  return (
    <div
      id="assistant-load-message"
      className="chat-load-message"
      role={failed ? 'alert' : 'status'}
    >
      <h2 id="assistant-title" className="sr-only">Assistant terminal</h2>
      <span>{failed ? 'The assistant interface could not load.' : 'Opening assistant...'}</span>
      {failed && (
        <button
          type="button"
          autoFocus
          onClick={onRetry}
          className="chat-load-retry chat-control"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function trapAssistantTab(event: ReactKeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Tab') return;
  const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  );
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (
    document.activeElement === first
    || document.activeElement === event.currentTarget
  )) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

export function ChatAssistant({
  intentChips,
  disclaimer,
  reducedMotion: reducedMotionOverride,
}: ChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<ChatFocusTarget | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const reducedMotion = reducedMotionOverride ?? prefersReducedMotion;
  const [ChatPanel, setChatPanel] = useState<ChatPanelComponent | null>(null);
  const [loadState, setLoadState] = useState<ChatPanelLoadState>(null);

  function openAssistant(opener: ChatFocusTarget) {
    updateChatAssistantState(openerRef, setOpen, opener);
  }

  function closeAssistant() {
    updateChatAssistantState(openerRef, setOpen, null);
  }

  function toggleAssistant(trigger: ChatFocusTarget) {
    if (open) closeAssistant();
    else openAssistant(trigger);
  }

  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeAssistant();
      return;
    }
    trapAssistantTab(event);
  }

  async function loadPanel() {
    setLoadState(false);
    try {
      const LoadedPanel = await import('@/components/chat/chat')
        .then((module) => module.Chat);
      setChatPanel(() => LoadedPanel);
    } catch {
      setLoadState(true);
    }
  }

  useEffect(() => {
    if (open && !ChatPanel && loadState === null) {
      void loadPanel();
    }
  }, [ChatPanel, loadState, open]);

  useEffect(() => {
    const stopListeningForOpen = listenForChatAssistantOpen(
      window as unknown as ChatAssistantOpenEventTarget,
      openAssistant,
    );
    function onFocusIn(event: FocusEvent) {
      const panel = panelRef.current!;
      if (
        openerRef.current
        && !panel.parentElement!.contains(event.target as Node | null)
      ) panel.focus();
    }

    document.addEventListener('focusin', onFocusIn);
    return () => {
      stopListeningForOpen();
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  // Follow open only so resolving the deferred panel cannot reapply the lock.
  useEffect(() => {
    if (open) {
      if (!ChatPanel) panelRef.current?.focus({ preventScroll: true });
      document.body.dataset.chat = '';
      return () => {
        delete document.body.dataset.chat;
      };
    }
  }, [open]);

  return (
    <div>
      <div
        ref={panelRef}
        id="dossier-chat-dialog"
        role="dialog"
        aria-labelledby="assistant-title"
        aria-describedby={ChatPanel ? 'assistant-disclaimer' : 'assistant-load-message'}
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        data-state={open ? 'open' : 'closed'}
        onKeyDown={handlePanelKeyDown}
        className={`chat-panel-frame${reducedMotion ? '' : ' chat-panel-motion'}`}
      >
        {ChatPanel && (
          <ChatPanel
            open={open}
            onClose={closeAssistant}
            intentChips={intentChips}
            disclaimer={disclaimer}
          />
        )}
        {!ChatPanel && (open || loadState !== null) && (
          <ChatPanelLoadStatus
            failed={loadState}
            onRetry={() => void loadPanel()}
          />
        )}
      </div>
      <ChatLauncher
        open={open}
        reducedMotion={reducedMotion}
        onToggle={toggleAssistant}
      />
    </div>
  );
}
