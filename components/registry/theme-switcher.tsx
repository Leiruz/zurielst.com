// Vendored from ncdai registry item "theme-switcher" (chanhdai.com/r, MIT).
// Do not edit without noting divergence in docs/components-map.md.
"use client"

import { useRef, useSyncExternalStore } from "react"
import { useTheme } from "next-themes"

// Divergence from vendored source (recorded in docs/components-map.md):
// IconPlaceholder is a registry template shim; replaced with inline SVG icons.

type ThemeChoice = "light" | "dark"

interface ThemeSelectionDependencies {
  currentTheme: string | undefined
  playSound(theme: ThemeChoice): void
  prefersReducedMotion(): boolean
  setTheme(theme: ThemeChoice): void
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

  try {
    if (!dependencies.prefersReducedMotion()) dependencies.playSound(nextTheme)
  } catch {
    // Optional audio can never prevent the explicit theme choice.
  }
  dependencies.setTheme(nextTheme)
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

const THEME_OPTIONS = ["light", "dark"] as const

function ThemeSwitcherControl({
  activeTheme,
  onSelect,
}: {
  activeTheme: ThemeChoice | undefined
  onSelect: (theme: ThemeChoice) => void
}) {
  return (
    <div
      className="theme-switcher-reveal"
      role="group"
      aria-label="Theme"
    >
      {THEME_OPTIONS.map((value) => (
        <button
          key={value}
          type="button"
          className="theme-switcher-button"
          aria-label={`Switch to ${value} theme`}
          aria-pressed={activeTheme === value}
          onClick={() => onSelect(value)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
          >
            <use href={`#theme-${value}`} />
          </svg>
        </button>
      ))}
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
    return <div className="flex h-11 w-[5.5rem]" />
  }

  const activeTheme = resolveActiveTheme(theme, resolvedTheme)

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
