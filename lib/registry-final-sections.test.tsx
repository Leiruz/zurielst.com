import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import Home from '@/app/page';
import NotFound from '@/app/not-found';
import { SECTION_LINE_NAV_ITEMS } from '@/components/section-line-nav';
import * as carouselEnhancement from '@/components/registry/logos-carousel-enhancement';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';
// @ts-expect-error Vite exposes the Markdown source through its raw query loader.
import componentsMap from '@/docs/components-map.md?raw';
// @ts-expect-error The Vitest config exposes the stylesheet source as a virtual text module.
import styles from 'virtual:globals-css-source';

vi.mock('server-only', () => ({}));

const profile = profileJson as Profile;
const glowGridModule = await import('@/components/registry/glow-card-grid').catch(() => ({}));
const sections = [
  ['identity', 'Identity'],
  ['intro', 'Introduction'],
  ['brands', 'Worked with'],
  ['capabilities', 'Capabilities'],
  ['stack', 'Stack'],
  ['work', 'Selected work'],
  ['timeline', 'Timeline'],
  ['education', 'Education'],
  ['proof', 'Accolades'],
  ['products', 'Products'],
  ['testimonials', 'Testimonials'],
  ['faq', 'FAQ'],
  ['insights', 'Insights'],
  ['contact', 'Contact'],
] as const;

const testimonialAttributions = [
  ['Tan Hock Guan', 'Retired Senior Lecturer, Ngee Ann Polytechnic'],
  ['Velicia Seraphine', 'Research Associate, Crafthealth'],
] as const;

const testimonialQuotes = [
  'CiTaDel has proven to be an invaluable cybersecurity asset, safeguarding the personal computers of all my family members. My decision to adopt CiTaDel as our cybersecurity solution was driven by its exceptional behavioral analysis capabilities, providing a proactive defense against emerging threats. The monthly CiTaDel Threat Report further enhances its efficacy, offering real-time insights that empower me to fortify and shield not only my own device but also those of my cherished loved ones.',
  "Embarking on CiTaDel's free trial, I discovered an exceptional antivirus tool. Its monthly reports not only bolster my computer's defenses but also shield it from potential threats. CiTaDel's affordability sets it apart, and its prowess in swiftly eradicating unintentionally installed malware surpasses other market options. As a research associate at Crafthealth, CiTaDel has proven indispensable in upholding our commitment to regulatory compliance, including NIST 800, GDPR, and HIPAA, safeguarding our pharmaceutical data with unmatched efficacy.",
] as const;

function between(markup: string, start: string, end: string) {
  return markup.slice(markup.indexOf(start), markup.indexOf(end, markup.indexOf(start)));
}

describe('final registry sections', () => {
  it('exports the vendored glow grid with reduced-motion pointer suppression', () => {
    const GlowCardGrid = Reflect.get(glowGridModule, 'GlowCardGrid');
    const GlowCard = Reflect.get(glowGridModule, 'GlowCard');
    const shouldTrackGlowPointer = Reflect.get(glowGridModule, 'shouldTrackGlowPointer');

    expect(GlowCardGrid).toBeTypeOf('function');
    expect(GlowCard).toBeTypeOf('function');
    expect(shouldTrackGlowPointer).toBeTypeOf('function');
    if (typeof shouldTrackGlowPointer !== 'function') return;
    expect(shouldTrackGlowPointer(false)).toBe(true);
    expect(shouldTrackGlowPointer(true)).toBe(false);
  });

  it('renders every profile product inside one keyboard-focusable glow grid', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const products = between(markup, '<section id="products"', '<section id="testimonials"');

    expect(products.match(/data-slot="glow-card-grid"/g)).toHaveLength(1);
    expect(products.match(/data-slot="glow-card"/g)).toHaveLength(profile.products.length);
    expect(products.match(/data-product-card="true"/g)).toHaveLength(profile.products.length);
    expect(products.match(/tabindex="0"/g)).toHaveLength(profile.products.length);

    for (const product of profile.products) {
      for (const value of [product.name, product.summary, product.period, product.note]) {
        if (!value) continue;
        const encodedValue = renderToStaticMarkup(createElement('span', null, value))
          .replace(/^<span>|<\/span>$/g, '');
        expect(products).toContain(encodedValue);
      }
      for (const stackItem of product.stack) expect(products).toContain(stackItem);
      for (const link of product.links) {
        expect(products).toContain(`href="${link.url}"`);
        expect(products).toContain(link.label);
      }
    }
  });

  it('uses dossier-token hover glow and a static reduced-motion fallback', () => {
    expect(styles).toMatch(/\.glow-card::before\s*\{[\s\S]*radial-gradient[\s\S]*var\(--ring\)/);
    expect(styles).toMatch(/\.glow-card:hover::before[\s\S]*\.glow-card:focus-visible::before[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.glow-card\s*\{[^}]*--glow-pointer-x:\s*50%[^}]*--glow-pointer-y:\s*50%/);
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.glow-card::before\s*\{[^}]*transition:\s*none/);
  });

  it('records the adopted staged glow grid SHA', () => {
    expect(componentsMap).toMatch(
      /glow-card-grid: newly vendored for Products[\s\S]*697511424edc76ff595359fdf5a32641096b62a102ca54d3fdac6d5d4954ad73/,
    );
  });

  it('normalizes a partially completed carousel wave before playback pauses', () => {
    const normalize = Reflect.get(carouselEnhancement, 'normalizeCarouselColumns') as unknown;
    expect(normalize).toBeTypeOf('function');
    if (typeof normalize !== 'function') return;

    const columnLengths = [3, 3, 2, 2];
    const step = 2;
    const columns = columnLengths.map((length, columnIndex) => {
      const logos = Array.from({ length }, (_, logoIndex) => ({
        dataset: {
          active: String(logoIndex === (columnIndex === 0 ? step % length : 1 % length)),
          ...(columnIndex === 1 && logoIndex === 1 ? { exiting: 'true' } : {}),
        } as Record<string, string>,
        removeAttribute(name: string) {
          if (name === 'data-exiting') delete this.dataset.exiting;
        },
      }));
      return { logos, querySelectorAll: () => logos };
    });

    normalize(columns, step);

    for (const [columnIndex, column] of columns.entries()) {
      const targetIndex = step % columnLengths[columnIndex];
      expect(column.logos.filter((logo) => logo.dataset.active === 'true')).toHaveLength(1);
      for (const [logoIndex, logo] of column.logos.entries()) {
        expect(logo.dataset.active).toBe(String(logoIndex === targetIndex));
        expect(logo.dataset.exiting).toBeUndefined();
      }
    }
  });

  it('renders the complete desktop section line navigation in static markup', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const nav = between(markup, '<nav data-section-line-nav="true"', '</nav>');

    expect(nav).toContain('fixed');
    expect(nav).toContain('left-0');
    expect(nav).toContain('hidden');
    expect(nav).toContain('xl:flex');
    expect(nav.match(/<a /g)).toHaveLength(sections.length);
    expect(nav.match(/data-line-nav-indicator="true"/g)).toHaveLength(sections.length);
    expect(nav.match(/data-line-nav-title="true"/g)).toHaveLength(sections.length);
    expect(nav.match(/data-line-nav-between="true"/g)).toHaveLength((sections.length - 1) * 2);
    expect(nav.match(/aria-current="location"/g)).toHaveLength(1);
    expect(
      [...nav.matchAll(/data-line-nav-title="true"[^>]*>([^<]*)<\/span>/g)].map((match) => match[1]),
    ).toEqual(sections.map(([, caption]) => caption));
    for (const [id, caption] of sections) {
      expect(nav).toContain(`href="#${id}"`);
      expect(nav).toContain(`aria-label="${caption}"`);
    }
  });

  it('defines one shell inset and centers wide shells in the space beside the line nav', () => {
    const wideShellRule = styles.match(/\.dossier-page\s+\.dossier-shell\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(styles).toMatch(/--section-line-nav-width:\s*10rem/);
    expect(styles).toMatch(/--section-line-nav-gutter:\s*12rem/);
    expect(styles).toMatch(/--dossier-shell-padding:\s*clamp\(1rem,\s*3vw,\s*2rem\)/);
    expect(styles).toMatch(
      /\.dossier-shell\s*\{[^}]*padding-inline:\s*var\(--dossier-shell-padding\)/,
    );
    expect(styles).toMatch(/@media\s*\(min-width:\s*80rem\)[\s\S]*\.section-line-nav\s*\{[^}]*width:\s*var\(--section-line-nav-width\)/);
    expect(wideShellRule).toMatch(
      /width:\s*min\(\s*calc\(\s*100%\s*-\s*var\(--section-line-nav-gutter\)\s*-\s*var\(--dossier-shell-padding\)\s*-\s*var\(--dossier-shell-padding\)\s*\),\s*80rem\s*\)/,
    );
    expect(wideShellRule).toMatch(
      /margin-left:\s*max\(\s*calc\(var\(--section-line-nav-gutter\)\s*\+\s*var\(--dossier-shell-padding\)\),\s*calc\(\(100%\s*\+\s*var\(--section-line-nav-gutter\)\s*-\s*80rem\)\s*\/\s*2\)\s*\)/,
    );
    expect(wideShellRule).toMatch(/margin-right:\s*auto/);
  });

  it.each([1280, 1440, 1600, 1920, 2560])(
    'keeps a balanced shell, a bounded width, and line-nav clearance at %ipx',
    (viewportWidth) => {
      const rootFontSize = 16;
      const navRight = 10 * rootFontSize;
      const navGutter = 12 * rootFontSize;
      const shellPadding = 2 * rootFontSize;
      const maxShellWidth = 80 * rootFontSize;
      const availableWidth = viewportWidth - navGutter;
      const shellWidth = Math.min(
        availableWidth - (2 * shellPadding),
        maxShellWidth,
      );
      const shellLeft = navGutter + ((availableWidth - shellWidth) / 2);
      const shellRightGap = viewportWidth - shellLeft - shellWidth;

      expect(shellRightGap).toBeGreaterThanOrEqual(shellPadding);
      expect(shellWidth).toBeLessThanOrEqual(maxShellWidth);
      expect(shellLeft - navGutter).toBeCloseTo(shellRightGap, 5);
      expect(navRight).toBeLessThan(shellLeft + shellPadding);
    },
  );

  it('caps and scales intro copy while vertically centering the desktop graph', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const intro = between(markup, '<section id="intro"', '<section id="brands"');

    expect(intro).toContain('data-intro-layout="true"');
    expect(intro).toContain('md:items-center');
    expect(intro).not.toContain('md:items-start');
    expect(intro).toContain('data-intro-copy="true"');
    expect(intro).toContain('class="intro-copy');
    expect(intro).toContain('data-intro-contributions-column="true"');
    expect(intro).not.toContain('md:pt-6');
    expect(styles).toMatch(/\.intro-copy\s*\{[^}]*max-width:\s*65ch/);
    expect(styles).toMatch(
      /@media\s*\(min-width:\s*80rem\)[\s\S]*\.intro-copy\s+\.dossier-prose\s*\{[^}]*font-size:\s*clamp\(0\.9375rem,\s*calc\(0\.6875rem\s*\+\s*0\.3125vw\),\s*1rem\)/,
    );
  });

  it('scopes the line-nav gutter to the landing dossier', () => {
    const homeMarkup = renderToStaticMarkup(createElement(Home));
    const notFoundMarkup = renderToStaticMarkup(createElement(NotFound));

    expect(homeMarkup).toContain('class="dossier-page bp-grid');
    expect(notFoundMarkup).not.toContain('dossier-page');
    expect(styles).not.toMatch(
      /@media\s*\(min-width:\s*80rem\)[\s\S]*?^\s{2}\.dossier-shell\s*\{/m,
    );
  });

  it('keeps line-nav items in the exact top-level section order', () => {
    expect(SECTION_LINE_NAV_ITEMS.map((item) => item.href.slice(1)))
      .toEqual(sections.map(([id]) => id));
  });

  it('renders all ten meaningful brand items once with pinned monochrome SVGs', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const brands = between(markup, '<section id="brands"', '<section id="capabilities"');

    expect(brands.match(/data-brand-item="true"/g)).toHaveLength(10);
    expect(brands.match(/data-brand-icon="true"/g)).toHaveLength(10);
    expect(brands.match(/<svg\b/g)).toHaveLength(10);
    expect(brands.match(/fill="currentColor"/g)).toHaveLength(10);
    const paths = [...brands.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);
    expect(paths).toHaveLength(10);
    expect(new Set(paths)).toHaveLength(10);
    expect(paths).toContain('M0 0v11.408h11.408V0zm12.594 0v11.408H24V0zM0 12.594V24h11.408V12.594zm12.594 0V24H24V12.594z');
    expect(brands).toContain('viewBox="0 0 64 64"');
    expect(brands).toContain('transform="translate(0 64) scale(.1 -.1)"');
    for (const brand of profile.stack_brands.brands) {
      expect(brands).toContain(brand.name);
      expect(brands).toContain(brand.context);
    }
    expect(brands).toContain(profile.stack_brands.disclaimer);
  });

  it('uses only the two live Citadel testimonials before FAQ', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const testimonials = between(markup, '<section id="testimonials"', '<section id="faq"');

    expect(testimonials.match(/data-testimonial-primary="true"/g)).toHaveLength(2);
    expect(testimonials).toContain('aria-hidden="true"');
    for (const [name, role] of testimonialAttributions) {
      expect(testimonials).toContain(name);
      expect(testimonials).toContain(role);
    }
    for (const quote of testimonialQuotes) {
      const encodedQuote = renderToStaticMarkup(createElement('span', null, quote)).replace(/^<span>|<\/span>$/g, '');
      expect(testimonials).toContain(encodedQuote);
    }
    expect(testimonials).not.toContain('Andrew Palmer');
  });

  it('pauses testimonial motion for interaction and becomes static under reduced motion', () => {
    expect(styles).toMatch(/\.testimonials-marquee:hover[\s\S]*animation-play-state:\s*paused/);
    expect(styles).toMatch(/\.testimonials-marquee:focus-within[\s\S]*animation-play-state:\s*paused/);
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.testimonials-marquee-track[\s\S]*animation:\s*none/);
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.logos-carousel[\s\S]*animation:\s*none/);
  });
});
