// Vendored from ncdai registry item "consent-manager" (chanhdai.com/r, MIT).
// Do not edit without noting divergence in docs/components-map.md.
"use client"

import {
  getConsentFromStorage,
  saveConsentToStorage,
  type ConsentState,
  type StorageConfig,
} from "@c15t/nextjs"
import { lazy, Suspense, useCallback, useEffect } from "react"
import {
  ConsentManagerProvider,
  useConsentManager,
} from "@c15t/nextjs/headless"

import { ConsentBanner } from "@/components/registry/consent-banner"
import { CONSENT_TRANSLATIONS } from "@/components/registry/consent-copy"
import { CloudflareWebAnalyticsLoader } from "@/components/registry/cloudflare-web-analytics"
import {
  listenForPrivacyChoicesOpen,
  type PrivacyChoicesOpenTarget,
} from "@/lib/privacy-choices"

type ConsentInfo = Parameters<
  typeof saveConsentToStorage
>[0]["consentInfo"]

type PersistedConsent = {
  consents?: { measurement?: boolean }
}

type ReadConsent = (storageConfig?: StorageConfig) => PersistedConsent | null

function readPersistedConsent(storageConfig?: StorageConfig) {
  return getConsentFromStorage<PersistedConsent>(storageConfig)
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

const DeferredConsentManagerDialog = lazy(() =>
  import("@/components/registry/consent-manager-dialog").then((module) => ({
    default: module.ConsentManagerDialog,
  }))
)

export function ConsentManagerDialogLoader({ isOpen }: { isOpen: boolean }) {
  if (!isOpen) return null

  return (
    <Suspense fallback={null}>
      <DeferredConsentManagerDialog />
    </Suspense>
  )
}

function ConsentManagerDialogMount() {
  const { isPrivacyDialogOpen } = useConsentManager()

  return <ConsentManagerDialogLoader isOpen={isPrivacyDialogOpen} />
}

function ConsentBannerMount() {
  const {
    saveConsents,
    setIsPrivacyDialogOpen,
    setShowPopup,
    showPopup,
  } = useConsentManager()

  if (!showPopup) return null

  return (
    <ConsentBanner
      onReject={() => {
        setShowPopup(false)
        saveConsents("necessary")
      }}
      onCustomize={() => {
        setIsPrivacyDialogOpen(true)
        setShowPopup(false, true)
      }}
      onAccept={() => {
        setShowPopup(false)
        saveConsents("all")
      }}
    />
  )
}

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

export function ConsentManager({ children }: { children: React.ReactNode }) {
  return (
    <ConsentManagerProvider
      options={{
        mode: "offline",
        consentCategories: ["necessary", "measurement"],
        translations: CONSENT_TRANSLATIONS,
        // ignoreGeoLocation: process.env.NODE_ENV === "development", // Useful for development to always view the banner.
      }}
    >
      <PrivacyChoicesListener />

      <ConsentBannerMount />

      <ConsentManagerDialogMount />

      <CloudflareWebAnalyticsMount />

      {children}
    </ConsentManagerProvider>
  )
}
