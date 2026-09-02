// Vendored from ncdai registry item "consent-manager" (chanhdai.com/r, MIT).
// Do not edit without noting divergence in docs/components-map.md.
"use client"

import { lazy, Suspense } from "react"
import { useConsentManager } from "@c15t/nextjs/headless"

import { ConsentBanner } from "@/components/registry/consent-banner"

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

export function ConsentManagerUi() {
  return (
    <>
      <ConsentBannerMount />
      <ConsentManagerDialogMount />
    </>
  )
}
