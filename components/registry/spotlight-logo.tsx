// Vendored from ncdai registry item "spotlight-logo" (chanhdai.com/r, MIT).
// Adapted to the decorative ZST wordmark without registry demo artwork or sound.
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export function SpotlightLogo({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      data-slot="spotlight-logo"
      className={cn('spotlight-logo', className)}
      {...props}
    >
      <span className="spotlight-logo-base">ZST</span>
      <span className="spotlight-logo-highlight">ZST</span>
    </span>
  );
}
