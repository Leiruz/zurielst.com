// Vendored from ncdai registry item "glow-card-grid" (chanhdai.com/r, MIT).
// Do not edit without noting divergence in docs/components-map.md.
"use client"

import { useEffect, useRef } from "react"
import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

export type GlowCardGridProps = ComponentPropsWithoutRef<"div">

export function shouldTrackGlowPointer(reducedMotion: boolean) {
  return !reducedMotion
}

export function GlowCardGrid({
  className,
  ...props
}: GlowCardGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handlePointerMove = (event: PointerEvent) => {
      const cards = grid.querySelectorAll<HTMLElement>("[data-slot='glow-card']")

      cards.forEach((card) => {
        const rect = card.getBoundingClientRect()
        card.style.setProperty("--glow-pointer-x", `${event.clientX - rect.left}px`)
        card.style.setProperty("--glow-pointer-y", `${event.clientY - rect.top}px`)
      })
    }
    const syncPointerTracking = () => {
      grid.removeEventListener("pointermove", handlePointerMove)
      if (shouldTrackGlowPointer(mediaQuery.matches)) {
        grid.addEventListener("pointermove", handlePointerMove)
      }
    }

    syncPointerTracking()
    mediaQuery.addEventListener("change", syncPointerTracking)

    return () => {
      grid.removeEventListener("pointermove", handlePointerMove)
      mediaQuery.removeEventListener("change", syncPointerTracking)
    }
  }, [])

  return (
    <div
      ref={gridRef}
      data-slot="glow-card-grid"
      className={cn("glow-card-grid grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
      {...props}
    />
  )
}

export type GlowCardProps = ComponentPropsWithoutRef<"article">

export function GlowCard({ className, tabIndex = 0, ...props }: GlowCardProps) {
  return (
    <article
      data-slot="glow-card"
      tabIndex={tabIndex}
      className={cn(
        "glow-card relative flex h-full min-w-0 flex-col overflow-hidden rounded-[0.875rem] border border-line bg-surface",
        className
      )}
      {...props}
    />
  )
}
