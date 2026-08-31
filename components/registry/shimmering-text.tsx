// Vendored from ncdai registry item "shimmering-text" (chanhdai.com/r, MIT).
// Adapted to progressive CSS so the one-second registry shimmer needs no client runtime.
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface ShimmerStyle extends CSSProperties {
  '--shimmer-duration': string;
}

export type ShimmeringTextProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  children?: ReactNode;
  text?: string;
  duration?: number;
  isStopped?: boolean;
};

export function ShimmeringText({
  children,
  className,
  duration = 1,
  isStopped = false,
  style,
  text,
  ...props
}: ShimmeringTextProps) {
  const content = text ?? children;

  return (
    <span
      data-slot="shimmering-text"
      className={cn('shimmering-text', isStopped && 'shimmering-text-stopped', className)}
      style={{ '--shimmer-duration': `${duration}s`, ...style } as ShimmerStyle}
      {...props}
    >
      {content}
    </span>
  );
}
