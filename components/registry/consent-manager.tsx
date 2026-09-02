// Vendored from ncdai registry item "consent-manager" (chanhdai.com/r, MIT).
// Do not edit without noting divergence in docs/components-map.md.
"use client"

import {
  getConsentFromStorage,
  saveConsentToStorage,
  type ConsentState,
  type StorageConfig,
} from "@c15t/nextjs"
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import {
  ConsentManagerProvider,
  useConsentManager,
} from "@c15t/nextjs/headless"

import { CONSENT_TRANSLATIONS } from "@/components/registry/consent-copy"
import {
  restorePersistedConsent,
  type PersistedConsent,
  type PersistedConsentCheck,
  type ValidPersistedConsent,
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

function ConsentManagerRuntime({
  children,
  mountUi,
  persistedConsentCheck,
}: {
  children: React.ReactNode
  mountUi: boolean
  persistedConsentCheck: PersistedConsentCheck
}) {
  const {
    consentInfo,
    consents,
    resetConsents,
    saveConsents,
    setSelectedConsent,
    setShowPopup,
    showPopup,
  } = useConsentManager()
  const reconciliationAttempted = useRef(false)
  const [reconciliationRan, setReconciliationRan] = useState(false)
  const [validationComplete, setValidationComplete] = useState(false)

  useLayoutEffect(() => {
    if (reconciliationAttempted.current) return
    reconciliationAttempted.current = true

    try {
      if (persistedConsentCheck.status === "valid") {
        const restored = restorePersistedConsent({
          consents,
          persistedConsent: persistedConsentCheck.consent,
          saveConsents,
          setSelectedConsent,
        })
        if (!restored) return
      } else {
        resetConsents()
        setShowPopup(true, true)
      }
      setReconciliationRan(true)
    } catch {
      // Keep analytics and consent UI blocked unless live state is denied.
    }
  }, [
    consents,
    persistedConsentCheck,
    resetConsents,
    saveConsents,
    setSelectedConsent,
    setShowPopup,
  ])

  const liveStateMatches = persistedConsentCheck.status === "valid"
    ? consentInfo?.type === "custom" &&
      !showPopup &&
      consentProfilesMatch(consents, persistedConsentCheck.consent.consents)
    : consentInfo === null &&
      showPopup &&
      consents.necessary &&
      !consents.experience &&
      !consents.functionality &&
      !consents.marketing &&
      !consents.measurement

  useLayoutEffect(() => {
    if (validationComplete || !reconciliationRan || !liveStateMatches) return
    setValidationComplete(true)
  }, [liveStateMatches, reconciliationRan, validationComplete])

  return (
    <>
      {validationComplete && mountUi ? <PrivacyChoicesListener /> : null}

      {validationComplete && mountUi ? (
        <Suspense fallback={null}>
          <DeferredConsentManagerUi />
        </Suspense>
      ) : null}

      {validationComplete ? <CloudflareWebAnalyticsMount /> : null}

      {validationComplete ? children : null}
    </>
  )
}

function consentProfilesMatch(
  left: ValidPersistedConsent["consents"],
  right: ValidPersistedConsent["consents"],
) {
  return left.necessary === right.necessary &&
    left.experience === right.experience &&
    left.functionality === right.functionality &&
    left.marketing === right.marketing &&
    left.measurement === right.measurement
}

export function ConsentManager({
  children,
  mountUi = true,
  persistedConsentCheck,
}: {
  children?: React.ReactNode
  mountUi?: boolean
  persistedConsentCheck: PersistedConsentCheck | null
}) {
  if (!persistedConsentCheck) return null

  return (
    <ConsentManagerProvider
      options={{
        mode: "offline",
        consentCategories: ["necessary", "measurement"],
        translations: CONSENT_TRANSLATIONS,
        // ignoreGeoLocation: process.env.NODE_ENV === "development", // Useful for development to always view the banner.
      }}
    >
      <ConsentManagerRuntime
        mountUi={mountUi}
        persistedConsentCheck={persistedConsentCheck}
      >
        {children}
      </ConsentManagerRuntime>
    </ConsentManagerProvider>
  )
}
