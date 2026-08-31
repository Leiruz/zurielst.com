// Vendored from ncdai registry item "fluid-gradient-text" (chanhdai.com/r, MIT).
// Adapted to dossier typography, unique SVG IDs, and reduced-motion restraint.
'use client';

import { useId, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';

import { cn } from '@/lib/utils';

interface FluidGradientBounds {
  left: number;
  width: number;
}

export function resolveFluidGradientPosition(
  clientX: number,
  bounds: FluidGradientBounds,
  shouldReduceMotion: boolean,
) {
  if (shouldReduceMotion || !Number.isFinite(bounds.width) || bounds.width <= 0) return 0.5;
  return Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1);
}

export type FluidGradientTextProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: ReactNode;
  text?: string;
  svgViewBoxWidth?: number;
  svgViewBoxHeight?: number;
};

export function FluidGradientText({
  children,
  className,
  svgViewBoxHeight = 180,
  svgViewBoxWidth = 720,
  text,
  ...props
}: FluidGradientTextProps) {
  const gradientId = `fluid-gradient-text-${useId().replaceAll(':', '')}`;
  const content = text ?? children;
  const label = typeof content === 'string' ? content : text ?? '';
  const shouldReduceMotion = useReducedMotion() ?? false;
  const gradientPosition = useMotionValue(0.5);
  const animatedGradientX = useSpring(
    useTransform(gradientPosition, [0, 1], [0, svgViewBoxWidth]),
    { stiffness: 150, damping: 25 },
  );

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    gradientPosition.set(resolveFluidGradientPosition(event.clientX, bounds, shouldReduceMotion));
  };

  const handlePointerLeave = () => {
    gradientPosition.set(0.5);
  };

  return (
    <div
      data-slot="fluid-gradient-text"
      data-gradient-motion={shouldReduceMotion ? 'static' : 'pointer'}
      className={cn('fluid-gradient-text dossier-display', className)}
      aria-label={label}
      onPointerMove={shouldReduceMotion ? undefined : handlePointerMove}
      onPointerLeave={shouldReduceMotion ? undefined : handlePointerLeave}
      {...props}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox={`0 0 ${svgViewBoxWidth} ${svgViewBoxHeight}`}
        role="presentation"
      >
        <defs>
          <motion.linearGradient
            id={gradientId}
            x1={shouldReduceMotion ? svgViewBoxWidth / 2 : animatedGradientX}
            y1="0"
            x2={svgViewBoxWidth / 2}
            y2={svgViewBoxHeight}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.625" stopColor="var(--text-3)" stopOpacity="0" />
            <stop offset="0.82" stopColor="var(--ring)" stopOpacity="0.75" />
            <stop offset="1" stopColor="var(--text-1)" />
          </motion.linearGradient>
        </defs>
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill={`url(#${gradientId})`}>
          {content}
        </text>
      </svg>
    </div>
  );
}
