'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import {
  CHAT_UNAVAILABLE_MESSAGE,
  isAbortError,
  requestChat,
  type ChatTurn,
} from '@/components/chat/chat-transport';

export interface TranscriptMessage extends ChatTurn {
  id: number;
}

export interface ChatProps {
  open: boolean;
  onClose(): void;
  opener: FocusTarget | null;
  intentChips: string[];
  disclaimer: string;
}

interface ChatTranscriptProps {
  messages: TranscriptMessage[];
  streaming: boolean;
}

interface FocusTarget {
  isConnected?: boolean;
  focus(options?: FocusOptions): void;
}

interface ChatKeyTarget {
  addEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
}

interface ChatTabEvent {
  key: string;
  shiftKey: boolean;
  preventDefault(): void;
}

interface ChatShortcutEvent {
  key: string;
  stopPropagation(): void;
}

type TimerHandle = ReturnType<typeof globalThis.setInterval>;
type ScheduleInterval = (callback: () => void, milliseconds: number) => TimerHandle;
type CancelInterval = (handle: TimerHandle) => void;

function abortActiveRequest(controllerRef: { current: AbortController | null }) {
  controllerRef.current?.abort();
  controllerRef.current = null;
}

export function focusStreamingControl(target: FocusTarget | null) {
  target?.focus({ preventScroll: true });
}

export function appendTranscriptDelta(
  messages: TranscriptMessage[],
  messageId: number,
  delta: string,
): TranscriptMessage[] {
  return messages.map((message) => (
    message.id === messageId
      ? { ...message, content: message.content + delta }
      : message
  ));
}

export function completeTranscriptAnswer(
  messages: TranscriptMessage[],
  messageId: number,
  answer: string,
): TranscriptMessage[] {
  return messages.map((message) => {
    if (message.id !== messageId) return message;
    const separator = message.content.length > 0 ? '\n\n' : '';
    return { ...message, content: message.content + separator + answer };
  });
}

export function transcriptHistory(messages: TranscriptMessage[]): ChatTurn[] {
  return messages
    .map(({ role, content }) => ({ role, content: content.trim() }))
    .filter((message) => message.content.length > 0)
    .slice(-4);
}

export function chatCharacterCount(input: string): number {
  return input.length;
}

export function canSendChat(
  input: string,
  streaming: boolean,
  retrySeconds: number,
): boolean {
  const characterCount = chatCharacterCount(input);
  return input.trim().length > 0
    && characterCount <= 500
    && !streaming
    && retrySeconds === 0;
}

export function startRetryCountdown(
  seconds: number,
  onTick: (seconds: number) => void,
  schedule: ScheduleInterval = (callback, milliseconds) => globalThis.setInterval(callback, milliseconds),
  cancel: CancelInterval = (handle) => globalThis.clearInterval(handle),
) {
  let remaining = Math.max(0, Math.ceil(seconds));
  onTick(remaining);
  if (remaining === 0) return () => {};

  const handle = schedule(() => {
    remaining = Math.max(0, remaining - 1);
    onTick(remaining);
    if (remaining === 0) cancel(handle);
  }, 1_000);

  return () => cancel(handle);
}

export function closeChatPanel(
  controllerRef: { current: AbortController | null },
  onClose: () => void,
  opener: FocusTarget | null,
) {
  abortActiveRequest(controllerRef);
  onClose();
  if (opener?.isConnected !== false) opener?.focus({ preventScroll: true });
}

export function listenForChatEscape(target: ChatKeyTarget, close: () => void) {
  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  }

  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}

export function trapChatTab(
  event: ChatTabEvent,
  dialog: HTMLDivElement | null,
  activeElement: Element | null,
) {
  if (event.key !== 'Tab') return;

  const focusable = dialog?.querySelectorAll<HTMLElement>(
    'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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

export function containChatShortcut(event: ChatShortcutEvent) {
  if (event.key === '`') event.stopPropagation();
}

export function ChatTranscript({ messages, streaming }: ChatTranscriptProps) {
  return (
    <div
      id="assistant-transcript"
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-busy={streaming}
      className="max-h-[42vh] min-h-36 space-y-4 overflow-y-auto px-4 py-5 sm:px-5"
    >
      {messages.length === 0 && (
        <p className="text-sm leading-6 text-text-3">
          Ask about Zuriel&apos;s published roles, projects, or proof.
        </p>
      )}
      {messages.map((message, index) => {
        const isActiveAnswer = streaming
          && message.role === 'assistant'
          && index === messages.length - 1;

        return (
          <div key={message.id} className="break-words">
            <p className="mb-1 text-[0.65rem] uppercase tracking-[0.16em] text-text-3">
              {message.role === 'user' ? 'You' : 'Assistant'}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-text-2" aria-atomic="false">
              {message.content || (isActiveAnswer ? 'Receiving response...' : '')}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function Chat({ open, onClose, opener, intentChips, disclaimer }: ChatProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [showIntentChips, setShowIntentChips] = useState(true);
  const controllerRef = useRef<AbortController | null>(null);
  const countdownCleanupRef = useRef<(() => void) | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const messageIdRef = useRef(1);
  const mountedRef = useRef(true);

  function close() {
    setShowIntentChips(false);
    closeChatPanel(controllerRef, onClose, opener);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortActiveRequest(controllerRef);
      countdownCleanupRef.current?.();
      countdownCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      abortActiveRequest(controllerRef);
      return;
    }

    inputRef.current?.focus({ preventScroll: true });
    return listenForChatEscape(document, close);
  }, [open]);

  function beginRetryCountdown(seconds: number) {
    countdownCleanupRef.current?.();
    countdownCleanupRef.current = startRetryCountdown(seconds, (remaining) => {
      if (mountedRef.current) setRetrySeconds(remaining);
    });
  }

  async function sendMessage(value: string) {
    if (!canSendChat(value, streaming, retrySeconds)) return;

    const message = value.trim();
    const history = transcriptHistory(messages);
    const userMessage: TranscriptMessage = {
      id: messageIdRef.current++,
      role: 'user',
      content: message,
    };
    const assistantMessage: TranscriptMessage = {
      id: messageIdRef.current++,
      role: 'assistant',
      content: '',
    };
    const controller = new AbortController();
    controllerRef.current = controller;
    focusStreamingControl(closeButtonRef.current);
    setInput('');
    setShowIntentChips(false);
    setStreaming(true);
    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const result = await requestChat({
        message,
        history,
        signal: controller.signal,
        onDelta(delta) {
          if (!mountedRef.current || controller.signal.aborted) return;
          setMessages((current) => appendTranscriptDelta(
            current,
            assistantMessage.id,
            delta,
          ));
        },
      });

      if (!mountedRef.current || controller.signal.aborted) return;
      if (!result.streamed) {
        setMessages((current) => completeTranscriptAnswer(
          current,
          assistantMessage.id,
          result.answer,
        ));
      }
      if (result.retryAfterSeconds > 0) {
        beginRetryCountdown(result.retryAfterSeconds);
      }
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted || isAbortError(error)) return;
      setMessages((current) => completeTranscriptAnswer(
        current,
        assistantMessage.id,
        CHAT_UNAVAILABLE_MESSAGE,
      ));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (mountedRef.current) setStreaming(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    containChatShortcut(event);
    trapChatTab(event, dialogRef.current, document.activeElement);
  }

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) close();
  }

  if (!open) return null;

  const characterCount = chatCharacterCount(input);
  const sendEnabled = canSendChat(input, streaming, retrySeconds);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 transition-opacity duration-150 motion-reduce:transition-none sm:p-6"
      onClick={handleBackdropClick}
    >
      <div
        id="dossier-chat-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assistant-title"
        aria-describedby="assistant-disclaimer"
        onKeyDown={handleDialogKeyDown}
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-line-strong bg-surface font-mono text-text-2 shadow-2xl transition-transform duration-150 motion-reduce:transition-none sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface px-4 py-4 sm:px-5">
          <div>
            <p className="fig-label">Fig. 9A. Assistant terminal</p>
            <h2 id="assistant-title" className="mt-2 text-base font-medium text-text-1">
              Ask the dossier
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="Close assistant"
            className="rounded-md px-3 py-2 text-lg leading-none text-text-3 transition-colors duration-150 hover:bg-surface-hover hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            ×
          </button>
        </header>

        <ChatTranscript messages={messages} streaming={streaming} />

        <div className="border-t border-line px-4 py-4 sm:px-5">
          {showIntentChips && (
            <div className="mb-4 flex flex-wrap gap-2" aria-label="Suggested questions">
              {intentChips.slice(0, 4).map((intent) => (
                <button
                  key={intent}
                  type="button"
                  onClick={() => void sendMessage(intent)}
                  disabled={streaming || retrySeconds > 0}
                  className="rounded-full border border-line-strong bg-canvas-raised px-3 py-2 text-left text-xs leading-5 text-text-2 transition-colors duration-150 hover:bg-surface-hover hover:text-text-1 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {intent}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit}>
            <label htmlFor="assistant-message" className="sr-only">
              Message for the assistant
            </label>
            <textarea
              ref={inputRef}
              autoFocus
              id="assistant-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={500}
              rows={2}
              disabled={streaming}
              aria-describedby="assistant-counter assistant-retry"
              placeholder="Ask about Zuriel's published profile"
              className="w-full resize-none rounded-lg border border-line-strong bg-canvas px-3 py-2 text-sm leading-6 text-text-1 outline-none placeholder:text-text-3 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-text-3">
                <span id="assistant-counter">{characterCount}/500</span>
                <span id="assistant-retry" className="ml-3" role="status">
                  {retrySeconds > 0 ? `Retry available in ${retrySeconds}s.` : ''}
                </span>
              </div>
              <button
                type="submit"
                disabled={!sendEnabled}
                className="rounded-md border border-line-strong bg-text-1 px-4 py-2 text-xs font-medium text-canvas transition-opacity duration-150 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {streaming ? 'Receiving...' : 'Send'}
              </button>
            </div>
          </form>
          <p id="assistant-disclaimer" className="mt-3 text-[0.68rem] leading-5 text-text-3">
            {disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}
