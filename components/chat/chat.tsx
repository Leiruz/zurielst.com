'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type UIEvent as ReactUIEvent,
} from 'react';

import {
  CHAT_UNAVAILABLE_MESSAGE,
  isAbortError,
  requestChat,
  type ChatRequestResult,
  type ChatTurn,
} from '@/components/chat/chat-transport';
import type { ChatFocusTarget } from '@/components/chat/chat-store';
import { usePrefersReducedMotion } from '@/components/dossier/use-prefers-reduced-motion';

export interface TranscriptMessage extends ChatTurn {
  id: number;
  presentation?: 'system';
}

export interface ChatProps {
  open: boolean;
  onClose(): void;
  intentChips: string[];
  disclaimer: string;
  reducedMotion?: boolean;
}

interface ChatTranscriptProps {
  messages: TranscriptMessage[];
  streaming: boolean;
  reducedMotion: boolean;
  intentChips?: string[];
  controlsDisabled?: boolean;
  onIntent?(intent: string): void;
}

interface ChatComposerProps {
  input: string;
  streaming: boolean;
  retrySeconds: number;
  disclaimer: string;
  reducedMotion: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  onInput(value: string): void;
  onSend(): void;
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
  ctrlKey: boolean;
  metaKey: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

interface ChatSubmitKey {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
}

interface TranscriptScrollPosition {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

type TimerHandle = ReturnType<typeof globalThis.setInterval>;
type ScheduleInterval = (callback: () => void, milliseconds: number) => TimerHandle;
type CancelInterval = (handle: TimerHandle) => void;

const MAX_TRANSCRIPT_MESSAGES = 60;

interface ChatInputFocusTarget extends ChatFocusTarget {
  scrollIntoView(options?: ScrollIntoViewOptions): void;
}

function abortActiveRequest(controllerRef: { current: AbortController | null }) {
  controllerRef.current?.abort();
  controllerRef.current = null;
}

export function focusChatInput(
  target: ChatInputFocusTarget | null,
  revealInShortViewport = false,
) {
  target?.focus({ preventScroll: true });
  if (revealInShortViewport) target?.scrollIntoView({ block: 'center' });
}

export const focusStreamingControl = focusChatInput;

export function shouldSendChatOnKeyDown(event: ChatSubmitKey): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing;
}

export function shouldSettleChatStreaming(
  activeController: AbortController | null,
  completedController: AbortController,
): boolean {
  return activeController === null || activeController === completedController;
}

export function canStartChatRequest(
  activeController: AbortController | null,
  input: string,
  streaming: boolean,
  retrySeconds: number,
): boolean {
  return activeController === null && canSendChat(input, streaming, retrySeconds);
}

export function shouldStickToTranscript(
  position: TranscriptScrollPosition,
  threshold = 24,
): boolean {
  const distanceFromBottom = position.scrollHeight
    - position.clientHeight
    - position.scrollTop;
  return distanceFromBottom <= threshold;
}

export function transcriptScrollDestination(
  messageCount: number,
  stickToBottom: boolean,
  scrollHeight: number,
): number | null {
  if (messageCount === 0) return 0;
  return stickToBottom ? scrollHeight : null;
}

export function trimTranscript(
  messages: TranscriptMessage[],
  limit = MAX_TRANSCRIPT_MESSAGES,
): TranscriptMessage[] {
  return messages.length <= limit ? messages : messages.slice(-limit);
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

export function settleTranscriptResponse(
  messages: TranscriptMessage[],
  assistantMessageId: number,
  systemMessageId: number,
  result: ChatRequestResult,
): TranscriptMessage[] {
  if (result.streamed) return messages;

  const settledMessages = messages.filter((message) => (
    message.id !== assistantMessageId || message.content.length > 0
  ));
  return trimTranscript([
    ...settledMessages,
    {
      id: systemMessageId,
      role: 'assistant',
      content: result.answer,
      presentation: 'system',
    },
  ]);
}

export function transcriptHistory(messages: TranscriptMessage[]): ChatTurn[] {
  return messages
    .filter((message) => message.presentation !== 'system')
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
  now: () => number = () => Date.now(),
) {
  const initialSeconds = Math.max(0, Math.ceil(seconds));
  const deadline = now() + initialSeconds * 1_000;
  let remaining = initialSeconds;
  onTick(remaining);
  if (remaining === 0) return () => {};

  const handle = schedule(() => {
    remaining = Math.max(0, Math.ceil((deadline - now()) / 1_000));
    onTick(remaining);
    if (remaining === 0) cancel(handle);
  }, 1_000);

  return () => cancel(handle);
}

export function closeChatPanel(
  controllerRef: { current: AbortController | null },
  onClose: () => void,
) {
  abortActiveRequest(controllerRef);
  onClose();
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
  if (event.shiftKey && (activeElement === first || activeElement === dialog)) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

export function containChatShortcut(event: ChatShortcutEvent) {
  const opensCommandPalette = event.key.toLowerCase() === 'k'
    && (event.ctrlKey || event.metaKey);
  if (opensCommandPalette) event.preventDefault();
  if (event.key === '`' || opensCommandPalette) event.stopPropagation();
}

function ThinkingIndicator() {
  return (
    <div
      className="chat-thinking mr-auto flex min-h-11 items-center gap-1.5 px-3"
      aria-label="Assistant is thinking"
      role="status"
    >
      <span className="chat-thinking-dot" aria-hidden="true" />
      <span className="chat-thinking-dot" aria-hidden="true" />
      <span className="chat-thinking-dot" aria-hidden="true" />
    </div>
  );
}

export function ChatTranscript({
  messages,
  streaming,
  reducedMotion,
  intentChips = [],
  controlsDisabled = false,
  onIntent,
}: ChatTranscriptProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript === null) return;
    const destination = transcriptScrollDestination(
      messages.length,
      stickToBottomRef.current,
      transcript.scrollHeight,
    );
    if (destination !== null) transcript.scrollTop = destination;
  }, [messages, streaming]);

  function handleScroll(event: ReactUIEvent<HTMLDivElement>) {
    stickToBottomRef.current = shouldStickToTranscript(event.currentTarget);
  }

  return (
    <div
      id="assistant-transcript"
      ref={transcriptRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-busy={streaming}
      onScroll={handleScroll}
      className="chat-transcript px-4 py-5 sm:px-5"
    >
      {messages.length === 0 && (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-text-2">
            Ask about Zuriel&apos;s published roles, projects, or accolades.
          </p>
          {intentChips.length > 0 && onIntent !== undefined && (
            <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
              {intentChips.slice(0, 4).map((intent) => (
                <button
                  key={intent}
                  type="button"
                  onClick={() => onIntent(intent)}
                  disabled={controlsDisabled}
                  className={`chat-control min-h-11 rounded-full border border-line-strong bg-canvas-raised px-3 py-2 text-left text-xs leading-5 text-text-2 disabled:cursor-not-allowed disabled:opacity-40${reducedMotion ? '' : ' chat-control-motion'}`}
                >
                  {intent}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {messages.map((message, index) => {
        if (message.presentation === 'system') {
          return (
            <aside
              key={message.id}
              data-message-kind="system"
              className="my-3 rounded-[10px] border border-dashed border-line-strong px-3 py-3 text-sm leading-6 text-text-2"
              role="status"
            >
              <p className="fig-label mb-1">System note</p>
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            </aside>
          );
        }

        const activeAnswer = streaming
          && message.role === 'assistant'
          && index === messages.length - 1;
        if (activeAnswer && message.content.length === 0) {
          return <ThinkingIndicator key={message.id} />;
        }

        const visitor = message.role === 'user';
        return (
          <article
            key={message.id}
            data-message-role={visitor ? 'visitor' : 'assistant'}
            className={`chat-bubble ${visitor ? 'chat-bubble-visitor ml-auto' : 'chat-bubble-assistant mr-auto'}`}
          >
            <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-text-3">
              {visitor ? 'Visitor' : 'Assistant'}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-2" aria-atomic="false">
              {message.content}
              {activeAnswer && message.content.length > 0 && (
                <span
                  data-stream-caret="true"
                  className="chat-stream-caret"
                  aria-hidden="true"
                />
              )}
            </p>
          </article>
        );
      })}
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      data-chat-icon="send"
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4 4 16 8-16 8 3-8-3-8Z" />
      <path d="M7 12h13" />
    </svg>
  );
}

export function ChatComposer({
  input,
  streaming,
  retrySeconds,
  disclaimer,
  reducedMotion,
  inputRef,
  onInput,
  onSend,
}: ChatComposerProps) {
  const characterCount = chatCharacterCount(input);
  const sendEnabled = canSendChat(input, streaming, retrySeconds);
  const counterVisible = characterCount > 400;
  const sendLabel = retrySeconds > 0
    ? `Send in ${retrySeconds} seconds`
    : 'Send';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSend();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (!shouldSendChatOnKeyDown({
      key: event.key,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
    })) return;

    event.preventDefault();
    onSend();
  }

  return (
    <form onSubmit={submit} className="shrink-0 border-t border-line px-4 py-4 sm:px-5">
      <div className="flex items-end gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="assistant-message" className="sr-only">
            Message for the assistant
          </label>
          <textarea
            ref={inputRef}
            id="assistant-message"
            value={input}
            onChange={(event) => onInput(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={500}
            rows={2}
            aria-describedby="assistant-counter assistant-disclaimer"
            placeholder="Ask about Zuriel's published profile"
            className="min-h-11 w-full resize-none rounded-[10px] border border-line-strong bg-canvas px-3 py-2 pr-14 text-sm leading-6 text-text-1 outline-none placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <span
            id="assistant-counter"
            data-counter-visible={counterVisible}
            aria-hidden={!counterVisible}
            className="chat-character-counter absolute bottom-2 right-3 font-mono text-xs text-text-3"
          >
            {characterCount}/500
          </span>
        </div>
        <button
          type="submit"
          disabled={!sendEnabled}
          aria-label={sendLabel}
          className={`chat-send chat-control flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-text-1 font-mono text-xs font-medium text-canvas disabled:cursor-not-allowed disabled:bg-canvas-raised disabled:text-text-3 disabled:opacity-100${reducedMotion ? '' : ' chat-control-motion'}`}
        >
          {retrySeconds > 0 ? `${retrySeconds}s` : <SendIcon />}
        </button>
      </div>
      <p id="assistant-disclaimer" className="mt-2 text-xs leading-5 text-text-3">
        {disclaimer}
      </p>
    </form>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function Chat({
  open,
  onClose,
  intentChips,
  disclaimer,
  reducedMotion,
}: ChatProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const motionReduced = reducedMotion ?? prefersReducedMotion;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const countdownCleanupRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageIdRef = useRef(1);
  const mountedRef = useRef(true);

  function close() {
    closeChatPanel(controllerRef, onClose);
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

    focusChatInput(
      inputRef.current,
      window.matchMedia('(max-height: 24rem)').matches,
    );
    return listenForChatEscape(document, close);
  }, [open, onClose]);

  function beginRetryCountdown(seconds: number) {
    countdownCleanupRef.current?.();
    countdownCleanupRef.current = startRetryCountdown(seconds, (remaining) => {
      if (mountedRef.current) setRetrySeconds(remaining);
    });
  }

  async function sendMessage(value: string) {
    if (!canStartChatRequest(
      controllerRef.current,
      value,
      streaming,
      retrySeconds,
    )) return;

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
    setInput('');
    setStreaming(true);
    setMessages((current) => trimTranscript([
      ...current,
      userMessage,
      assistantMessage,
    ]));

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
        const systemMessageId = messageIdRef.current++;
        setMessages((current) => settleTranscriptResponse(
          current,
          assistantMessage.id,
          systemMessageId,
          result,
        ));
      }
      if (result.retryAfterSeconds > 0) {
        beginRetryCountdown(result.retryAfterSeconds);
      }
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted || isAbortError(error)) return;
      const systemMessageId = messageIdRef.current++;
      setMessages((current) => settleTranscriptResponse(
        current,
        assistantMessage.id,
        systemMessageId,
        {
          answer: CHAT_UNAVAILABLE_MESSAGE,
          retryAfterSeconds: 0,
          streamed: false,
        },
      ));
    } finally {
      if (controller.signal.aborted && mountedRef.current) {
        setMessages((current) => current.filter((item) => (
          item.id !== assistantMessage.id || item.content.length > 0
        )));
      }
      const settleStreaming = shouldSettleChatStreaming(
        controllerRef.current,
        controller,
      );
      if (controllerRef.current === controller) controllerRef.current = null;
      if (mountedRef.current && settleStreaming) setStreaming(false);
    }
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    containChatShortcut(event);
  }

  return (
    <div
      onKeyDown={handleDialogKeyDown}
      className="chat-panel-content"
    >
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4 py-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id="assistant-title" className="fig-label truncate">
            Assistant terminal
          </h2>
          <span
            data-chat-status={streaming ? 'streaming' : 'idle'}
            className="chat-status"
            role="status"
          >
            <span className="chat-status-dot" aria-hidden="true" />
            <span className="sr-only">
              {streaming ? 'Assistant is responding' : 'Assistant is idle'}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close the assistant"
          className={`chat-control flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 hover:bg-surface-hover hover:text-text-1${motionReduced ? '' : ' chat-control-motion'}`}
        >
          <CloseIcon />
        </button>
      </header>

      <ChatTranscript
        messages={messages}
        streaming={streaming}
        reducedMotion={motionReduced}
        intentChips={intentChips}
        controlsDisabled={streaming || retrySeconds > 0}
        onIntent={(intent) => void sendMessage(intent)}
      />

      <ChatComposer
        input={input}
        streaming={streaming}
        retrySeconds={retrySeconds}
        disclaimer={disclaimer}
        reducedMotion={motionReduced}
        inputRef={inputRef}
        onInput={setInput}
        onSend={() => void sendMessage(input)}
      />
    </div>
  );
}
