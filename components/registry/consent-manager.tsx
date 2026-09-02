// Vendored from ncdai registry item "consent-manager" (chanhdai.com/r, MIT).
// Do not edit without noting divergence in docs/components-map.md.
"use client"

import {
  getConsentFromStorage,
  saveConsentToStorage,
  type ConsentState,
  type StorageConfig,
} from "@c15t/nextjs"
import { lazy, Suspense, useCallback, useEffect, useRef } from "react"
import {
  ConsentManagerProvider,
  useConsentManager,
} from "@c15t/nextjs/headless"

import { CONSENT_TRANSLATIONS } from "@/components/registry/consent-copy"
import {
  restorePersistedConsent,
  type PersistedConsent,
} from "@/components/registry/consent-hydration"
import { CloudflareWebAnalyticsLoader } from "@/components/registry/cloudflare-web-analytics"
import {
  listenForPrivacyChoicesOpen,
  type PrivacyChoicesOpenTarget,
} from "@/lib/privacy-choices"

type ConsentInfo = Parameters<
  typeof saveConsentToStorage
>[0]["consentInfo"]

type ReadConsent = (storageConfig?: StorageConfig) => PersistedConsent | null

function readPersistedConsent(storageConfig?: StorageConfig) {
  return getConsentFromStorage<PersistedConsent>(storageConfig)
}

function PersistedConsentHydrator() {
  const {
    consents,
    saveConsents,
    setSelectedConsent,
    storageConfig,
  } = useConsentManager()
  const hasRestored = useRef(false)

  useEffect(() => {
    if (hasRestored.current) return
    hasRestored.current = true

    try {
      const persistedConsent = readPersistedConsent(storageConfig)
      restorePersistedConsent({
        consents,
        persistedConsent,
        saveConsents,
        setSelectedConsent,
      })
    } catch {
      // Keep the provider's fail-closed defaults when storage is unavailable.
    }
  }, [consents, saveConsents, setSelectedConsent, storageConfig])

  return null
}

export function persistDeniedMeasurementConsent({
  consentInfo,
  consents,
  readConsent = readPersistedConsent,
  saveConsent = saveConsentToStorage,
  storageConfig,
}: {
  consentInfo: ConsentInfo | null
  consents: ConsentState
  readConsent?: ReadConsent
  saveConsent?: typeof saveConsentToStorage
  storageConfig?: StorageConfig
}) {
  if (!consentInfo || consents.measurement) return false

  try {
    saveConsent({ consents, consentInfo }, undefined, storageConfig)
    return readConsent(storageConfig)?.consents?.measurement === false
  } catch {
    return false
  }
}

const DeferredConsentManagerUi = lazy(() =>
  import("@/components/registry/consent-manager-ui").then((module) => ({
    default: module.ConsentManagerUi,
  }))
)

function PrivacyChoicesListener() {
  const { setIsPrivacyDialogOpen } = useConsentManager()

  useEffect(
    () => listenForPrivacyChoicesOpen(
      window as unknown as PrivacyChoicesOpenTarget,
      () => setIsPrivacyDialogOpen(true),
    ),
    [setIsPrivacyDialogOpen],
  )

  return null
}

function CloudflareWebAnalyticsMount() {
  const { consentInfo, consents, storageConfig } = useConsentManager()
  const persistDeniedConsent = useCallback(
    () =>
      persistDeniedMeasurementConsent({
        consentInfo,
        consents,
        storageConfig,
      }),
    [consentInfo, consents, storageConfig],
  )

  return (
    <CloudflareWebAnalyticsLoader
      measurementGranted={consents.measurement}
      persistDeniedConsent={persistDeniedConsent}
    />
  )
}

export function ConsentManager({
  children,
  mountUi = true,
}: {
  children: React.ReactNode
  mountUi?: boolean
}) {
  return (
    <ConsentManagerProvider
      options={{
        mode: "offline",
        consentCategories: ["necessary", "measurement"],
        translations: CONSENT_TRANSLATIONS,
        // ignoreGeoLocation: process.env.NODE_ENV === "development", // Useful for development to always view the banner.
      }}
    >
      <PersistedConsentHydrator />

      {mountUi ? <PrivacyChoicesListener /> : null}

      {mountUi ? (
        <Suspense fallback={null}>
          <DeferredConsentManagerUi />
        </Suspense>
      ) : null}

      <CloudflareWebAnalyticsMount />

      {children}
    </ConsentManagerProvider>
  )
}
