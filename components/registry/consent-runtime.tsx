"use client"

import { lazy, Suspense, useEffect, useRef, useState } from "react"

import {
  type PersistedConsentCheck,
  validatePersistedConsent,
} from "@/components/registry/consent-hydration"
import { CloudflareWebAnalyticsLoader } from "@/components/registry/cloudflare-web-analytics"

const DEFAULT_CONSENT_STORAGE_KEY = "c15t"
const LEGACY_CONSENT_STORAGE_KEY = "privacy-consent-storage"
const COMPRESSED_COOKIE_KEYS = {
  c: "consents",
  eid: "identified",
  i: "consentInfo",
  id: "id",
  t: "time",
  ts: "timestamp",
  y: "type",
} as const
const refuseDeniedPersistence = () => false

const DeferredConsentManager = lazy(() =>
  import("@/components/registry/consent-manager").then((module) => ({
    default: module.ConsentManager,
  }))
)

export function checkPersistedConsent(): PersistedConsentCheck {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { consent: null, status: "absent" }
  }

  let result: PersistedConsentCheck
  try {
    const localConsent = readRawLocalConsent(DEFAULT_CONSENT_STORAGE_KEY)
    const cookieConsent = readCookieConsent(DEFAULT_CONSENT_STORAGE_KEY)
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

  if (result.status === "invalid") deletePersistedConsentBestEffort()
  return result
}

export function ConsentRuntime({
  children,
  mountUi,
}: {
  children?: React.ReactNode
  mountUi: boolean
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

  const measurementGranted =
    persistedConsentCheck.status === "valid" &&
    persistedConsentCheck.consent.consents.measurement

  return (
    <>
      <CloudflareWebAnalyticsLoader
        measurementGranted={measurementGranted}
        persistDeniedConsent={refuseDeniedPersistence}
      />

      {mountUi ? (
        <Suspense fallback={null}>
          <DeferredConsentManager
            persistedConsentCheck={persistedConsentCheck}
          >
            {children}
          </DeferredConsentManager>
        </Suspense>
      ) : null}
    </>
  )
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

function readCookieConsent(storageKey: string): unknown {
  const cookiePrefix = `${storageKey}=`
  const cookie = document.cookie
    .split(";")
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith(cookiePrefix))
  if (!cookie) return null

  const value = cookie.slice(cookiePrefix.length)
  if (!value.includes(":")) return value

  // Match c15t's compact cookie format without importing its store runtime.
  const consent: Record<string, unknown> = Object.create(null)
  for (const pair of value.split(",")) {
    const separator = pair.indexOf(":")
    if (separator < 1) continue

    const compressedPath = pair.slice(0, separator).split(".")
    if (compressedPath.some((segment) => !isSafeCookieKey(segment))) continue

    const path = compressedPath.map(expandCookieKey)
    setCookieValue(consent, path, parseCookieValue(pair.slice(separator + 1)))
  }
  return consent
}

function expandCookieKey(key: string) {
  return COMPRESSED_COOKIE_KEYS[key as keyof typeof COMPRESSED_COOKIE_KEYS] ?? key
}

function isSafeCookieKey(key: string) {
  return key !== "__proto__" && key !== "constructor" && key !== "prototype"
}

function setCookieValue(
  target: Record<string, unknown>,
  path: string[],
  value: unknown,
) {
  let cursor = target
  for (const key of path.slice(0, -1)) {
    const next = cursor[key]
    if (!isPlainRecord(next)) {
      cursor[key] = Object.create(null)
    }
    cursor = cursor[key] as Record<string, unknown>
  }

  const finalKey = path.at(-1)
  if (finalKey) cursor[finalKey] = value
}

function parseCookieValue(value: string): unknown {
  if (value === "1") return true
  if (value === "0") return false
  if (value === "") return null

  const numericValue = Number(value)
  return Number.isNaN(numericValue) ? value : numericValue
}

function deletePersistedConsentBestEffort() {
  try {
    window.localStorage.removeItem(DEFAULT_CONSENT_STORAGE_KEY)
    window.localStorage.removeItem(LEGACY_CONSENT_STORAGE_KEY)
  } catch {
    // The invalid result still keeps analytics blocked.
  }

  try {
    document.cookie = `${DEFAULT_CONSENT_STORAGE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    document.cookie = `${LEGACY_CONSENT_STORAGE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  } catch {
    // The invalid result still keeps analytics blocked.
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
