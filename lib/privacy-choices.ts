import {
  drainPendingOpenRequests,
  takePendingOpenRequest,
  type PendingOpenRequestTarget,
} from '@/lib/pending-open-requests';

export const PRIVACY_CHOICES_OPEN_EVENT = 'dossier:privacy-choices-open';

interface PrivacyChoicesOpenEvent {
  detail?: unknown;
}

export interface PrivacyChoicesOpenTarget extends PendingOpenRequestTarget {
  CustomEvent: new (type: string, init?: { detail?: unknown }) => PrivacyChoicesOpenEvent;
  addEventListener(type: string, listener: (event: PrivacyChoicesOpenEvent) => void): void;
  dispatchEvent(event: PrivacyChoicesOpenEvent): boolean | void;
  removeEventListener(type: string, listener: (event: PrivacyChoicesOpenEvent) => void): void;
}

export function requestPrivacyChoicesOpen(
  target: PrivacyChoicesOpenTarget,
  opener: unknown,
) {
  (target.__dossierPendingOpenRequests ??= []).push({
    detail: opener,
    eventType: PRIVACY_CHOICES_OPEN_EVENT,
  });
  target.dispatchEvent(
    new target.CustomEvent(PRIVACY_CHOICES_OPEN_EVENT, { detail: opener }),
  );
}

export function listenForPrivacyChoicesOpen(
  target: PrivacyChoicesOpenTarget,
  open: (opener: unknown) => void,
) {
  for (const request of drainPendingOpenRequests(target, PRIVACY_CHOICES_OPEN_EVENT)) {
    open(request.detail);
  }

  function onOpenEvent(event: PrivacyChoicesOpenEvent) {
    const pending = takePendingOpenRequest(target, PRIVACY_CHOICES_OPEN_EVENT);
    open(pending ? pending.detail : event.detail);
  }

  target.addEventListener(PRIVACY_CHOICES_OPEN_EVENT, onOpenEvent);
  return () => target.removeEventListener(PRIVACY_CHOICES_OPEN_EVENT, onOpenEvent);
}
