import type {
  AllConsentNames,
  ConsentState,
} from "@c15t/nextjs"

export type PersistedConsent = {
  consentInfo?: unknown
  consents?: Partial<ConsentState>
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
  if (!persistedConsent?.consentInfo || !persistedConsent.consents) return false

  const storedConsents = persistedConsent.consents
  if (
    !CONSENT_CATEGORIES.every(
      (category) => typeof storedConsents[category] === "boolean",
    )
  ) return false
  if (storedConsents.necessary !== true) return false

  for (const category of CONSENT_CATEGORIES) {
    setSelectedConsent(category, storedConsents[category] as boolean)
  }
  saveConsents("custom")
  return true
}
