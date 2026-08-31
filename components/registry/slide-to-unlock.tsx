// Vendored from ncdai registry item "slide-to-unlock" (chanhdai.com/r, MIT).
// Do not edit without noting divergence in docs/components-map.md.
"use client"

import type { ComponentProps, ComponentPropsWithoutRef, JSX } from "react"
import { createContext, useCallback, useContext, useRef, useState } from "react"
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react"

import { cn } from "@/lib/utils"

type SlideToUnlockContextValue = {
  x: MotionValue<number>
  trackRef: React.RefObject<HTMLDivElement | null>
  isDragging: boolean
  handleWidth: number
  textOpacity: MotionValue<number>
  onDragStart: () => void
  onDragEnd: () => void
  onKeyboardStep: (key: string) => void
  onKeyboardRelease: (key: string) => void
  unlock: (disabled: boolean, key?: string) => boolean
}

type SlideUnlockState = { current: boolean }

const KEYBOARD_PROGRESS_STEP = 0.125

export function advanceSlideKeyboardProgress(
  current: number,
  key: string,
): number {
  if (key === "ArrowRight") {
    return Math.min(1, current + KEYBOARD_PROGRESS_STEP)
  }
  if (key === "ArrowLeft") {
    return Math.max(0, current - KEYBOARD_PROGRESS_STEP)
  }
  return current
}

export function attemptSlideUnlock(
  state: SlideUnlockState,
  onUnlock: () => void,
  disabled = false,
  key?: string,
): boolean {
  const keyboardActivation = key === undefined || key === "Enter" || key === " "
  if (disabled || state.current || !keyboardActivation) return false

  state.current = true
  onUnlock()
  return true
}

const SlideToUnlockContext = createContext<SlideToUnlockContextValue | null>(
  null
)

function useSlideToUnlock() {
  const context = useContext(SlideToUnlockContext)
  if (!context) {
    throw new Error(
      `SlideToUnlock components must be used within SlideToUnlock`
    )
  }
  return context
}

export type SlideToUnlockRootProps = ComponentProps<"div"> & {
  /**
   * Width of the drag handle in pixels.
   * @defaultValue 56
   * */
  handleWidth?: number
  /** Called when the handle is dragged fully to the end. */
  onUnlock?: () => void
}

export function SlideToUnlock({
  className,
  handleWidth = 56,
  children,
  onUnlock,
  ...props
}: SlideToUnlockRootProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const x = useMotionValue(0)
  const unlockedRef = useRef(false)

  const fadeDistance = handleWidth
  const textOpacity = useTransform(x, [0, fadeDistance], [1, 0])

  const handleDragStart = useCallback(() => {
    setIsDragging(true)
  }, [])

  const unlock = useCallback((disabled: boolean, key?: string) => (
    attemptSlideUnlock(unlockedRef, onUnlock ?? (() => {}), disabled, key)
  ), [onUnlock])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)

    const trackWidth = trackRef.current?.offsetWidth || 0
    const maxX = trackWidth - handleWidth

    if (maxX > 0 && x.get() >= maxX) {
      unlock(false)
    } else {
      animate(x, 0, { type: "spring", bounce: 0, duration: 0.25 })
    }
  }, [x, unlock, handleWidth])

  const handleKeyboardStep = useCallback((key: string) => {
    if (unlockedRef.current) return
    const trackWidth = trackRef.current?.offsetWidth || 0
    const maxX = trackWidth - handleWidth
    if (maxX <= 0) return

    const progress = x.get() / maxX
    const nextProgress = advanceSlideKeyboardProgress(progress, key)
    x.set(nextProgress * maxX)
    if (nextProgress >= 1) unlock(false)
  }, [handleWidth, unlock, x])

  const handleKeyboardRelease = useCallback((key: string) => {
    if (
      (key === "ArrowRight" || key === "ArrowLeft")
      && !unlockedRef.current
    ) {
      animate(x, 0, { type: "spring", bounce: 0, duration: 0.25 })
    }
  }, [x])

  return (
    <SlideToUnlockContext.Provider
      value={{
        x,
        trackRef,
        isDragging,
        handleWidth,
        textOpacity,
        onDragStart: handleDragStart,
        onDragEnd: handleDragEnd,
        onKeyboardStep: handleKeyboardStep,
        onKeyboardRelease: handleKeyboardRelease,
        unlock,
      }}
    >
      <div
        data-slot="slide-to-unlock"
        className={cn(
          "w-54 rounded-xl bg-muted p-1 shadow-inner inset-ring-1 inset-ring-foreground/10",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </SlideToUnlockContext.Provider>
  )
}

export type SlideToUnlockTrackProps = ComponentProps<"div">

export function SlideToUnlockTrack({
  className,
  children,
  ...props
}: SlideToUnlockTrackProps) {
  const { trackRef } = useSlideToUnlock()

  return (
    <div
      ref={trackRef}
      data-slot="track"
      className={cn(
        "relative flex h-10 items-center justify-center",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export type SlideToUnlockTextProps = Omit<
  ComponentPropsWithoutRef<typeof motion.div>,
  "children"
> & {
  /**
   * Accepts a render function as `children` to react to the dragging state.
   *
   * @example
   * ```tsx
   * <SlideToUnlockText>
   *   {({ isDragging }) => <span>{isDragging ? "Release..." : "Slide to unlock"}</span>}
   * </SlideToUnlockText>
   * ```
   */
  children: JSX.Element | ((props: { isDragging: boolean }) => JSX.Element)
}

export function SlideToUnlockText({
  className,
  children,
  style,
  ...props
}: SlideToUnlockTextProps) {
  const { handleWidth, textOpacity, isDragging } = useSlideToUnlock()

  return (
    <motion.div
      data-slot="text"
      data-dragging={isDragging}
      className={cn("pl-1 text-lg font-medium", className)}
      style={{ marginLeft: handleWidth, opacity: textOpacity, ...style }}
      {...props}
    >
      {typeof children === "function" ? children({ isDragging }) : children}
    </motion.div>
  )
}

export type SlideToUnlockHandleProps = ComponentPropsWithoutRef<
  typeof motion.button
>

export function SlideToUnlockHandle({
  className,
  children,
  disabled = false,
  "aria-label": ariaLabel = "Slide to unlock",
  onDragStart: suppliedOnDragStart,
  onDragEnd: suppliedOnDragEnd,
  onKeyDown,
  onKeyUp,
  style,
  ...props
}: SlideToUnlockHandleProps) {
  const {
    x,
    trackRef,
    onDragStart,
    onDragEnd,
    onKeyboardStep,
    onKeyboardRelease,
    unlock,
    handleWidth: width,
  } = useSlideToUnlock()

  return (
    <motion.button
      {...props}
      type="button"
      data-slot="handle"
      data-haptic
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        "absolute top-0 left-0 flex h-10 cursor-grab items-center justify-center rounded-lg border-0 bg-white p-0 text-zinc-400 shadow-sm active:cursor-grabbing disabled:cursor-default disabled:opacity-70",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6",
        className
      )}
      style={{ width, x, ...style }}
      drag={disabled ? false : "x"}
      dragConstraints={trackRef}
      dragElastic={0}
      dragMomentum={false}
      onDragStart={(event, info) => {
        suppliedOnDragStart?.(event, info)
        if (!disabled) onDragStart()
      }}
      onDragEnd={(event, info) => {
        suppliedOnDragEnd?.(event, info)
        if (!disabled) onDragEnd()
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented || disabled) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          unlock(false, event.key)
          return
        }
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault()
          onKeyboardStep(event.key)
        }
      }}
      onKeyUp={(event) => {
        onKeyUp?.(event)
        if (!disabled) onKeyboardRelease(event.key)
      }}
    >
      {children ?? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M24 12 12.75 3v4.696H0v8.608h12.75V21z"
            fill="currentColor"
          />
        </svg>
      )}
    </motion.button>
  )
}
