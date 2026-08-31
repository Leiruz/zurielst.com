// Vendored from ncdai registry item "scroll-fade-effect" (chanhdai.com/r, MIT).
// The registry overflow mask is preserved and entrance is a progressive CSS adapter.
import type { ComponentProps, CSSProperties } from 'react';

import { cn } from '@/lib/utils';

interface ScrollFadeStyle extends CSSProperties {
  '--scroll-fade-range-end'?: string;
  '--scroll-fade-range-start'?: string;
}

const SCROLL_FADE_BASE_RANGE_END = 28;
const SCROLL_FADE_STAGGER_STEP = 1.5;

export type ScrollFadeEffectProps = ComponentProps<'div'> & {
  /** Scroll direction for the registry overflow fade mask. */
  orientation?: 'horizontal' | 'vertical';
  /** Enables a CSS scroll-driven entrance without a client observer. */
  entrance?: boolean;
  /** Adds a scroll-progress stagger comparable to 40ms per item, capped at four steps. */
  delayIndex?: number;
};

export function ScrollFadeEffect({
  className,
  delayIndex = 0,
  entrance = false,
  orientation = 'vertical',
  style,
  ...props
}: ScrollFadeEffectProps) {
  const cappedDelayIndex = Math.min(Math.max(Math.floor(delayIndex), 0), 4);
  const rangeOffset = cappedDelayIndex * SCROLL_FADE_STAGGER_STEP;
  const entranceStyle: ScrollFadeStyle = entrance
    ? {
        '--scroll-fade-range-end': `${SCROLL_FADE_BASE_RANGE_END + rangeOffset}%`,
        '--scroll-fade-range-start': `${rangeOffset}%`,
        ...style,
      }
    : style ?? {};

  return (
    <div
      data-slot="scroll-fade-effect"
      data-orientation={orientation}
      data-scroll-fade-effect={entrance ? 'entrance' : 'overflow'}
      className={cn(
        !entrance && (orientation === 'horizontal'
          ? 'overflow-x-auto scroll-fade-effect-x'
          : 'overflow-y-auto scroll-fade-effect-y'),
        entrance && 'scroll-fade-entrance',
        className,
      )}
      style={entranceStyle}
      {...props}
    />
  );
}
