// Vendored from ncdai registry item "text-flip" (chanhdai.com/r, MIT).
// Adapted to a server-rendered CSS track with a three-second role interval.
import { Children, type CSSProperties, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface TextFlipStyle extends CSSProperties {
  '--text-flip-count': number;
  '--text-flip-duration': string;
}

export type TextFlipProps = {
  as?: 'span' | 'p' | 'code';
  children?: ReactNode | ReactNode[];
  className?: string;
  interval?: number;
  play?: boolean;
  words?: readonly string[];
};

export function TextFlip({
  as: Component = 'span',
  children,
  className,
  interval = 3,
  play = true,
  words,
}: TextFlipProps) {
  const items = words ? [...words] : Children.toArray(children);
  const firstItem = items[0];
  if (firstItem === undefined) return null;

  const style: TextFlipStyle = {
    '--text-flip-count': items.length,
    '--text-flip-duration': `${items.length * interval}s`,
  };

  return (
    <Component
      aria-live="off"
      data-interval-ms={interval * 1_000}
      data-slot="text-flip"
      className={cn('text-flip-viewport', !play && 'text-flip-stopped', className)}
    >
      <span className="sr-only">{firstItem}</span>
      <span aria-hidden="true" className="text-flip-track" style={style}>
        {[...items, firstItem].map((item, index) => (
          <span className="text-flip-item" key={index}>{item}</span>
        ))}
      </span>
    </Component>
  );
}
