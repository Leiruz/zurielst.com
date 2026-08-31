// Vendored from ncdai registry item "testimonial" (chanhdai.com/r, MIT).
// Adapted to dossier tokens and the public Citadel attribution shape.
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export function Testimonial({ className, ...props }: ComponentProps<'figure'>) {
  return (
    <figure
      data-slot="testimonial"
      className={cn('flex h-full min-w-0 flex-col rounded-[14px] border border-line bg-surface', className)}
      {...props}
    />
  );
}

export function TestimonialQuote({ className, ...props }: ComponentProps<'blockquote'>) {
  return (
    <blockquote
      data-slot="testimonial-quote"
      className={cn('grow p-5 text-sm leading-6 text-text-2 sm:text-base sm:leading-7', className)}
      {...props}
    />
  );
}

export function TestimonialAuthor({ className, ...props }: ComponentProps<'figcaption'>) {
  return (
    <figcaption
      data-slot="testimonial-author"
      className={cn('border-t border-line px-5 py-4', className)}
      {...props}
    />
  );
}

export function TestimonialAuthorName({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="testimonial-author-name"
      className={cn('font-mono text-sm font-semibold text-text-1', className)}
      {...props}
    />
  );
}

export function TestimonialAuthorTagline({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="testimonial-author-tagline"
      className={cn('mt-1 text-xs leading-5 text-text-3', className)}
      {...props}
    />
  );
}
