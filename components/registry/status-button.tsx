// Vendored from ncdai registry item "status-button" (chanhdai.com/r, MIT).
// Adapted to a semantic mailto anchor for the portfolio availability action.
import type { AnchorHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export type StatusButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

export function StatusButton({ children, className, ...props }: StatusButtonProps) {
  return (
    <a
      data-slot="status-button"
      className={cn(
        'status-button inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 font-mono text-xs text-text-1 transition-colors duration-150 hover:bg-surface-hover motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      <span className="status-button-dot" aria-hidden="true" />
      {children}
    </a>
  );
}
