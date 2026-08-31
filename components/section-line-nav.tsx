'use client';

import { useEffect, useState } from 'react';

import { LineNav } from '@/components/registry/line-nav';

export const SECTION_LINE_NAV_ITEMS = [
  { href: '#identity', title: 'Identity' },
  { href: '#intro', title: 'Introduction' },
  { href: '#brands', title: 'Worked with' },
  { href: '#capabilities', title: 'Capabilities' },
  { href: '#stack', title: 'Stack' },
  { href: '#work', title: 'Selected work' },
  { href: '#timeline', title: 'Timeline' },
  { href: '#education', title: 'Education' },
  { href: '#proof', title: 'Accolades' },
  { href: '#products', title: 'Products' },
  { href: '#testimonials', title: 'Testimonials' },
  { href: '#faq', title: 'FAQ' },
  { href: '#insights', title: 'Insights' },
  { href: '#contact', title: 'Contact' },
] as const;

export function SectionLineNav() {
  const [activeHref, setActiveHref] = useState<(typeof SECTION_LINE_NAV_ITEMS)[number]['href']>(
    SECTION_LINE_NAV_ITEMS[0].href,
  );

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sections = SECTION_LINE_NAV_ITEMS
      .map((item) => document.getElementById(item.href.slice(1)))
      .filter((section): section is HTMLElement => section !== null);
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.set(`#${entry.target.id}`, entry.intersectionRatio);
        else visible.delete(`#${entry.target.id}`);
      }
      const next = [...visible.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
      if (next) setActiveHref(next as (typeof SECTION_LINE_NAV_ITEMS)[number]['href']);
    }, {
      rootMargin: '-20% 0px -55% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <LineNav
      items={SECTION_LINE_NAV_ITEMS}
      activeHref={activeHref}
      className="section-line-nav fixed left-0 top-1/2 z-30 hidden -translate-y-1/2 px-3 xl:flex"
    />
  );
}
