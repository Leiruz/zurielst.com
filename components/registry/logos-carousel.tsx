// Vendored from ncdai registry item "logos-carousel" (chanhdai.com/r, MIT).
// Adapted so every meaningful child remains present exactly once in static markup.
import { Children } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface LogosCarouselProps {
  children: ReactNode;
  className?: string;
  columnCount?: number;
  direction?: 'ltr' | 'rtl';
  id: string;
}

export function LogosCarousel({
  children,
  className,
  columnCount = 4,
  direction = 'ltr',
  id,
}: LogosCarouselProps) {
  const logos = Children.toArray(children);
  const effectiveColumnCount = Math.min(columnCount, logos.length);
  const columns = Array.from({ length: effectiveColumnCount }, () => [] as ReactNode[]);
  for (const [index, logo] of logos.entries()) columns[index % effectiveColumnCount].push(logo);

  return (
    <div
      id={id}
      data-slot="logos-carousel"
      data-direction={direction}
      className={cn('logos-carousel grid', className)}
      style={{ '--logos-column-count': columns.length } as CSSProperties}
    >
      {columns.map((column, columnIndex) => (
        <div
          key={columnIndex}
          data-slot="logos-carousel-column"
          className="logos-carousel-column relative min-w-0"
        >
          {column.map((logo, logoIndex) => (
            <div
              key={logoIndex}
              data-slot="logos-carousel-logo"
              data-active={logoIndex === 0 ? 'true' : 'false'}
              className="logos-carousel-logo min-w-0"
              style={{ '--logo-index': logoIndex } as CSSProperties}
            >
              {logo}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
