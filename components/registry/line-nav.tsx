// Vendored from ncdai registry item "line-nav" (chanhdai.com/r, MIT).
// Adapted to native anchors, dossier tokens, location semantics, and reduced motion.
'use client';

import { Fragment, memo, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface LineNavItem {
  href: string;
  title: string;
}

interface LineNavProps {
  activeHref: string;
  className?: string;
  items: readonly LineNavItem[];
  label?: string;
  scrollActiveIntoView?: boolean;
}

export function LineNav({
  activeHref,
  className,
  items,
  label = 'Page sections',
  scrollActiveIntoView = false,
}: LineNavProps) {
  const activeItemRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!scrollActiveIntoView) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activeItemRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center',
    });
  }, [activeHref, scrollActiveIntoView]);

  return (
    <nav
      data-section-line-nav="true"
      aria-label={label}
      className={cn('flex flex-col gap-1', className)}
    >
      {items.map((item, index) => {
        const active = item.href === activeHref;
        return (
          <Fragment key={item.href}>
            <LineNavAnchor
              ref={active ? activeItemRef : undefined}
              active={active}
              item={item}
            />
            {index < items.length - 1 ? (
              <>
                <span data-line-nav-between="true" aria-hidden="true" className="block h-px w-6 bg-line-strong" />
                <span data-line-nav-between="true" aria-hidden="true" className="block h-px w-6 bg-line-strong" />
              </>
            ) : null}
          </Fragment>
        );
      })}
    </nav>
  );
}

const LineNavAnchor = memo(function LineNavAnchor({
  active,
  item,
  ref,
}: {
  active: boolean;
  item: LineNavItem;
  ref?: React.Ref<HTMLAnchorElement>;
}) {
  return (
    <a
      ref={ref}
      href={item.href}
      aria-label={item.title}
      aria-current={active ? 'location' : undefined}
      className="line-nav-anchor group flex h-4 items-center gap-2 text-text-3 focus-visible:text-text-1"
    >
      <span
        data-line-nav-indicator="true"
        aria-hidden="true"
        className="line-nav-indicator block h-px shrink-0 bg-current"
      />
      <span
        data-line-nav-title="true"
        className="whitespace-nowrap font-mono text-[0.62rem] text-text-3 group-hover:text-text-1 group-focus-visible:text-text-1 group-aria-[current=location]:text-text-1"
      >
        {item.title}
      </span>
    </a>
  );
});
