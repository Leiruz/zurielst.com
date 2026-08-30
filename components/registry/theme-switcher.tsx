// Vendored from ncdai registry item "theme-switcher" (chanhdai.com/r, MIT).
// Do not edit without noting divergence in docs/components-map.md.
"use client"

import type { JSX, ReactNode } from "react"
import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"

// Divergence from vendored source (recorded in docs/components-map.md):
// IconPlaceholder is a registry template shim; replaced with inline SVG icons.

function ThemeIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  )
}

function ThemeOption({
  icon,
  value,
  isActive,
  onClick,
}: {
  icon: JSX.Element
  value: string
  isActive?: boolean
  onClick: (value: string) => void
}) {
  return (
    <button
      data-active={isActive}
      className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground transition-[color] hover:text-foreground data-[active=true]:text-foreground [&_svg]:size-4"
      role="radio"
      aria-checked={isActive}
      aria-label={`Switch to ${value} theme`}
      onClick={() => onClick(value)}
    >
      {icon}

      <span
        aria-hidden="true"
        className={
          "pointer-events-none absolute inset-0 rounded-full border transition-[opacity,transform] duration-300 " +
          (isActive ? "scale-100 opacity-100" : "scale-75 opacity-0")
        }
      />
    </button>
  )
}

const THEME_OPTIONS = [
  {
    icon: (
      <ThemeIcon>
        <rect height="14" rx="2" width="20" x="2" y="3" />
        <path d="M8 21h8M12 17v4" />
      </ThemeIcon>
    ),
    value: "system",
  },
  {
    icon: (
      <ThemeIcon>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </ThemeIcon>
    ),
    value: "light",
  },
  {
    icon: (
      <ThemeIcon>
        <path d="M20.99 12.49A9 9 0 1 1 11.51 3a6 6 0 0 0 8.67 8.67c.35-.22.83 0 .81.82Z" />
      </ThemeIcon>
    ),
    value: "dark",
  },
]

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!isMounted) {
    return <div className="flex h-8 w-24" />
  }

  return (
    <div
      key={String(isMounted)}
      className="theme-switcher-reveal inline-flex items-center overflow-clip rounded-full bg-background inset-ring-1 inset-ring-border"
      role="radiogroup"
    >
      {THEME_OPTIONS.map((option) => (
        <ThemeOption
          key={option.value}
          icon={option.icon}
          value={option.value}
          isActive={theme === option.value}
          onClick={setTheme}
        />
      ))}
    </div>
  )
}

export { ThemeSwitcher }
