import { CONSENT_TRANSLATIONS } from "@/components/registry/consent-copy"

const buttonClassName =
  "inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

export function ConsentBanner({
  onAccept,
  onCustomize,
  onReject,
}: {
  onAccept: () => void
  onCustomize: () => void
  onReject: () => void
}) {
  const { description, title } =
    CONSENT_TRANSLATIONS.translations.en.cookieBanner

  return (
    <aside
      aria-labelledby="consent-banner-title"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-xl divide-y overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 dark:ring-foreground/20"
      data-testid="cookie-banner-root"
      role="dialog"
    >
      <div className="space-y-2 p-5">
        <h2
          className="text-base leading-none font-medium text-foreground"
          id="consent-banner-title"
        >
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <button
          className={`${buttonClassName} bg-secondary text-secondary-foreground hover:bg-secondary/80`}
          data-testid="cookie-banner-reject-button"
          onClick={onReject}
          type="button"
        >Reject all</button>
        <button
          className={`${buttonClassName} bg-secondary text-secondary-foreground hover:bg-secondary/80`}
          data-testid="cookie-banner-accept-button"
          onClick={onAccept}
          type="button"
        >Accept all</button>
        <button
          className={`${buttonClassName} bg-primary text-primary-foreground hover:bg-primary/90`}
          data-testid="cookie-banner-customize-button"
          onClick={onCustomize}
          type="button"
        >Customize</button>
      </div>
    </aside>
  )
}
