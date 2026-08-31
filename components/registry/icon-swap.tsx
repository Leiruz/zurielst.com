// Vendored from ncdai registry item "icon-swap" (chanhdai.com/r, MIT).
// Do not edit without noting divergence in docs/components-map.md.
"use client"

import type { AnimatePresenceProps, HTMLMotionProps } from "motion/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

export function iconSwapTransition(reducedMotion: boolean) {
  return reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.3, bounce: 0 }
}

export function IconSwap(props: React.PropsWithChildren<AnimatePresenceProps>) {
  return (
    <span data-slot="icon-swap">
      <AnimatePresence mode="popLayout" initial={false} {...props} />
    </span>
  )
}

export function IconSwapItem({
  ...props
}: HTMLMotionProps<"span">) {
  const reducedMotion = useReducedMotion()
  const visible = { opacity: 1, scale: 1, filter: "blur(0px)" }

  return (
    <motion.span
      data-slot="icon-swap-item"
      initial={reducedMotion ? visible : { opacity: 0, scale: 0.25, filter: "blur(4px)" }}
      animate={visible}
      exit={reducedMotion ? visible : { opacity: 0, scale: 0.25, filter: "blur(4px)" }}
      transition={iconSwapTransition(Boolean(reducedMotion))}
      {...props}
    />
  )
}
