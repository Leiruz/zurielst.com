// Vendored from ncdai registry item "consent-manager" (chanhdai.com/r, MIT).
// Do not edit without noting divergence in docs/components-map.md.
"use client"

import {
  deleteConsentFromStorage,
  getCookie,
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
  validatePersistedConsent,
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

type PersistedConsentCheck =
  | { consent: null; status: "absent" | "invalid" }
  | { consent: ValidPersistedConsent; status: "valid" }

const DEFAULT_CONSENT_STORAGE_KEY = "c15t"
const LEGACY_CONSENT_STORAGE_KEY = "privacy-consent-storage"

function readPersistedConsent(storageConfig?: StorageConfig) {
  return getConsentFromStorage<PersistedConsent>(storageConfig)
}

function checkPersistedConsent(storageConfig?: StorageConfig): PersistedConsentCheck {
  if (typeof window === "undefined") return { consent: null, status: "absent" }

  let result: PersistedConsentCheck
  try {
    const storageKey = storageConfig?.storageKey ?? DEFAULT_CONSENT_STORAGE_KEY
    const localConsent = readRawLocalConsent(storageKey)
    const cookieConsent = getCookie<unknown>(storageKey)
    const rawConsent = cookieConsent || localConsent

    if (!rawConsent) return { consent: null, status: "absent" }

    const consent = validatePersistedConsent(rawConsent, {
      allowOmittedFalse: Boolean(cookieConsent),
    })
    result = consent
      ? { consent, status: "valid" }
      : { consent: null, status: "invalid" }
  } catch {
    result = { consent: null, status: "invalid" }
  }

  if (result.status === "invalid") {
    try {
      deleteConsentFromStorage(undefined, storageConfig)
    } catch {
      // The runtime barrier below still resets live state and blocks analytics.
    }
  }

  return result
}

function readRawLocalConsent(storageKey: string) {
  const storage = window.localStorage

  if (storageKey !== LEGACY_CONSENT_STORAGE_KEY) {
    const current = storage.getItem(storageKey)
    if (current) {
      storage.removeItem(LEGACY_CONSENT_STORAGE_KEY)
    } else {
      const legacy = storage.getItem(LEGACY_CONSENT_STORAGE_KEY)
      if (legacy) {
        storage.setItem(storageKey, legacy)
        storage.removeItem(LEGACY_CONSENT_STORAGE_KEY)
      }
    }
  }

  const stored = storage.getItem(storageKey)
  return stored ? JSON.parse(stored) as unknown : null
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

function ConsentRuntime({
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
}: {
  children: React.ReactNode
  mountUi?: boolean
}) {
  const [persistedConsentCheck, setPersistedConsentCheck] =
    useState<PersistedConsentCheck | null>(null)
  const hasCheckedPersistedConsent = useRef(false)

  useEffect(() => {
    if (hasCheckedPersistedConsent.current) return
    hasCheckedPersistedConsent.current = true
    setPersistedConsentCheck(checkPersistedConsent())
  }, [])

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
      <ConsentRuntime
        mountUi={mountUi}
        persistedConsentCheck={persistedConsentCheck}
      >
        {children}
      </ConsentRuntime>
    </ConsentManagerProvider>
  )
}
