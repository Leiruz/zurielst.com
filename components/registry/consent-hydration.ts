import type {
  AllConsentNames,
  ConsentState,
} from "@c15t/nextjs"

export type PersistedConsent = {
  consentInfo?: unknown
  consents?: Partial<ConsentState>
}

export type ValidPersistedConsent = {
  consentInfo: Record<string, unknown>
  consents: ConsentState
}

const CONSENT_CATEGORIES = [
  "necessary",
  "functionality",
  "experience",
  "marketing",
  "measurement",
] as const satisfies readonly AllConsentNames[]

export function restorePersistedConsent({
  consents,
  persistedConsent,
  saveConsents,
  setSelectedConsent,
}: {
  consents: ConsentState
  persistedConsent: PersistedConsent | null
  saveConsents: (type: "custom") => void
  setSelectedConsent: (name: AllConsentNames, value: boolean) => void
}) {
  const validatedConsent = validatePersistedConsent(persistedConsent)
  if (!validatedConsent) return false

  for (const category of CONSENT_CATEGORIES) {
    setSelectedConsent(category, validatedConsent.consents[category])
  }
  saveConsents("custom")
  return true
}

export function validatePersistedConsent(
  persistedConsent: unknown,
  { allowOmittedFalse = false }: { allowOmittedFalse?: boolean } = {},
): ValidPersistedConsent | null {
  if (!isRecord(persistedConsent)) return null
  if (!isRecord(persistedConsent.consentInfo)) return null
  if (
    typeof persistedConsent.consentInfo.time !== "number" ||
    !Number.isFinite(persistedConsent.consentInfo.time)
  ) return null
  if (!isRecord(persistedConsent.consents)) return null

  const consents = {} as ConsentState
  for (const category of CONSENT_CATEGORIES) {
    const value = persistedConsent.consents[category]
    if (typeof value === "boolean") {
      consents[category] = value
      continue
    }
    if (allowOmittedFalse && value === undefined && category !== "necessary") {
      consents[category] = false
      continue
    }
    return null
  }
  if (!consents.necessary) return null

  return {
    consentInfo: persistedConsent.consentInfo,
    consents,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
