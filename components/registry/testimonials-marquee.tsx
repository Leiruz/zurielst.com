// Local adapter for ncdai registry item "testimonials-marquee" (chanhdai.com/r, MIT).
// The registry item is metadata-only and depends on an uninstalled third-party marquee.
import type { ReactNode } from 'react';

interface TestimonialsMarqueeProps {
  children: ReactNode;
  duplicateChildren: ReactNode;
}

export function TestimonialsMarquee({ children, duplicateChildren }: TestimonialsMarqueeProps) {
  return (
    <div
      data-slot="testimonials-marquee"
      className="testimonials-marquee"
      role="region"
      aria-label="Client testimonials"
      tabIndex={0}
    >
      <div className="testimonials-marquee-track">
        <div className="testimonials-marquee-group testimonials-marquee-primary">
          {children}
        </div>
        <div className="testimonials-marquee-group testimonials-marquee-duplicate" aria-hidden="true">
          {duplicateChildren}
        </div>
      </div>
    </div>
  );
}
