export interface ChatFocusTarget {
  isConnected?: boolean;
  focus(options?: FocusOptions): void;
}

interface SessionStorageTarget {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface BrowserStorageTarget {
  readonly sessionStorage: SessionStorageTarget;
}

const ASSISTANT_ATTENTION_KEY = 'zst-chat-assistant-attention-seen';

export function claimAssistantAttention(
  storage: SessionStorageTarget,
  reducedMotion: boolean,
): boolean {
  if (reducedMotion) return false;

  try {
    if (storage.getItem(ASSISTANT_ATTENTION_KEY) !== null) return false;
    storage.setItem(ASSISTANT_ATTENTION_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export function claimBrowserAssistantAttention(
  browser: object,
  reducedMotion: boolean,
): boolean {
  try {
    return claimAssistantAttention(
      (browser as BrowserStorageTarget).sessionStorage,
      reducedMotion,
    );
  } catch {
    return false;
  }
}
