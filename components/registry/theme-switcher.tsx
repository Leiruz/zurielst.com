// Vendored from ncdai registry item "theme-switcher" (chanhdai.com/r, MIT).
// Do not edit without noting divergence in docs/components-map.md.
"use client"

import { useRef, useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { flushSync } from "react-dom"

import { IconSwap, IconSwapItem } from "@/components/registry/icon-swap"

// Divergence from vendored source (recorded in docs/components-map.md):
// IconPlaceholder is a registry template shim; replaced with inline SVG icons.

type ThemeChoice = "light" | "dark"

interface ThemeSelectionDependencies {
  currentTheme: string | undefined
  playSound(theme: ThemeChoice): void
  prefersReducedMotion(): boolean
  setTheme(theme: ThemeChoice): void
  startViewTransition?(update: () => void): unknown
  commitTheme?(update: () => void): void
}

function browserAudioContext() {
  if (typeof window === "undefined") return null

  const AudioContextConstructor = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return AudioContextConstructor ? new AudioContextConstructor() : null
}

function createThemeAudioContextGetter(
  createContext: () => AudioContext | null = browserAudioContext,
) {
  let context: AudioContext | null | undefined
  return () => {
    if (context !== undefined) return context
    try {
      context = createContext()
    } catch {
      context = null
    }
    return context
  }
}

function selectThemeChoice(
  nextTheme: ThemeChoice,
  dependencies: ThemeSelectionDependencies,
) {
  if (dependencies.currentTheme === nextTheme) return

  let reducedMotion = true
  try {
    reducedMotion = dependencies.prefersReducedMotion()
  } catch {
    // Missing motion preferences use the instant, silent fallback.
  }

  if (!reducedMotion) {
    try {
      dependencies.playSound(nextTheme)
    } catch {
      // Optional audio can never prevent the explicit theme choice.
    }
  }

  const updateTheme = () => {
    const update = () => dependencies.setTheme(nextTheme)
    if (dependencies.commitTheme) dependencies.commitTheme(update)
    else update()
  }

  if (!reducedMotion && dependencies.startViewTransition) {
    let updated = false
    try {
      dependencies.startViewTransition(() => {
        updated = true
        updateTheme()
      })
      return
    } catch {
      if (updated) return
    }
  }

  updateTheme()
}

function resolveActiveTheme(
  theme: string | undefined,
  resolvedTheme: string | undefined,
): ThemeChoice | undefined {
  if (theme === "light" || theme === "dark") return theme
  if (resolvedTheme === "light" || resolvedTheme === "dark") {
    return resolvedTheme
  }
  return undefined
}

function ThemeSwitcherControl({
  activeTheme,
  onSelect,
}: {
  activeTheme: ThemeChoice
  onSelect: (theme: ThemeChoice) => void
}) {
  const nextTheme = activeTheme === "dark" ? "light" : "dark"
  const actionLabel = `Switch to ${nextTheme} theme`

  return (
    <div className="theme-switcher-reveal">
      <button
        type="button"
        className="theme-switcher-button"
        aria-label={actionLabel}
        data-haptic
        onClick={() => onSelect(nextTheme)}
      >
        <IconSwap>
          <IconSwapItem key={activeTheme} data-icon-key={activeTheme}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <use href={`#theme-${activeTheme}`} />
            </svg>
          </IconSwapItem>
        </IconSwap>
      </button>
      <span className="sr-only" aria-live="polite">{actionLabel}</span>
    </div>
  )
}

function ThemeSwitcher() {
  const { resolvedTheme, setTheme, theme } = useTheme()
  const audioContextGetterRef = useRef<ReturnType<typeof createThemeAudioContextGetter> | null>(null)

  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!isMounted) {
    return <div className="flex h-11 w-11" />
  }

  const activeTheme = resolveActiveTheme(theme, resolvedTheme)
  if (!activeTheme) {
    return <div className="flex h-11 w-11" />
  }

  function selectTheme(nextTheme: ThemeChoice) {
    selectThemeChoice(nextTheme, {
      currentTheme: theme,
      playSound(themeChoice) {
        audioContextGetterRef.current ??= createThemeAudioContextGetter()
        const context = audioContextGetterRef.current()
        if (!context) return

        if (context.state === "suspended") {
          void context.resume().catch(() => {})
        }
        void import("@/lib/theme-toggle-sound")
          .then(({ scheduleThemeToggleSound }) => {
            scheduleThemeToggleSound(context, themeChoice)
          })
          .catch(() => {})
      },
      prefersReducedMotion: () => typeof window.matchMedia !== "function"
        || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      setTheme,
      startViewTransition: (
        document as Document & {
          startViewTransition?: (update: () => void) => unknown
        }
      ).startViewTransition?.bind(document),
      commitTheme: flushSync,
    })
  }

  return (
    <ThemeSwitcherControl
      activeTheme={activeTheme}
      onSelect={selectTheme}
    />
  )
}

export {
  createThemeAudioContextGetter,
  resolveActiveTheme,
  selectThemeChoice,
  ThemeSwitcher,
  ThemeSwitcherControl,
}
