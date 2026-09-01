import { describe, expect, it, vi } from 'vitest';

import {
  PRIVACY_CHOICES_OPEN_EVENT,
  listenForPrivacyChoicesOpen,
  requestPrivacyChoicesOpen,
  type PrivacyChoicesOpenTarget,
} from '@/lib/privacy-choices';

interface TestEvent {
  detail?: unknown;
  type: string;
}

function createTarget(): PrivacyChoicesOpenTarget {
  const listeners = new Map<string, (event: TestEvent) => void>();
  return {
    CustomEvent: class {
      detail?: unknown;
      type: string;

      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    addEventListener(type: string, listener: (event: TestEvent) => void) {
      listeners.set(type, listener);
    },
    dispatchEvent(event: TestEvent) {
      listeners.get(event.type)?.(event);
    },
    removeEventListener(type: string, listener: (event: TestEvent) => void) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
}

describe('privacy choices open bridge', () => {
  it('consumes a queued pre-mount request exactly once when the listener starts', () => {
    const target = createTarget();
    const opener = { id: 'privacy-choices' };
    const open = vi.fn();

    requestPrivacyChoicesOpen(target, opener);
    expect(target.__dossierPendingOpenRequests).toEqual([
      { detail: opener, eventType: PRIVACY_CHOICES_OPEN_EVENT },
    ]);

    const cleanup = listenForPrivacyChoicesOpen(target, open);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(opener);
    expect(target.__dossierPendingOpenRequests).toBeUndefined();

    cleanup();
  });
});
