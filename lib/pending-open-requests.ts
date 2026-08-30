export interface PendingOpenRequest {
  detail: unknown;
  eventType: string;
}

export interface PendingOpenRequestTarget {
  __dossierPendingOpenRequests?: PendingOpenRequest[];
}

export function drainPendingOpenRequests(
  target: PendingOpenRequestTarget,
  eventType: string,
): PendingOpenRequest[] {
  const matching = target.__dossierPendingOpenRequests?.filter(
    (request) => request.eventType === eventType,
  ) ?? [];
  const remaining = target.__dossierPendingOpenRequests?.filter(
    (request) => request.eventType !== eventType,
  ) ?? [];
  if (remaining.length > 0) target.__dossierPendingOpenRequests = remaining;
  else delete target.__dossierPendingOpenRequests;
  return matching;
}

export function takePendingOpenRequest(
  target: PendingOpenRequestTarget,
  eventType: string,
): PendingOpenRequest | undefined {
  const pending = target.__dossierPendingOpenRequests;
  const index = pending?.findIndex((request) => request.eventType === eventType) ?? -1;
  if (!pending || index < 0) return undefined;
  const [request] = pending.splice(index, 1);
  if (pending.length === 0) delete target.__dossierPendingOpenRequests;
  return request;
}
