import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import Home from '@/app/page';
import * as carouselEnhancement from '@/components/registry/logos-carousel-enhancement';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';
// @ts-expect-error The Vitest config exposes the stylesheet source as a virtual text module.
import styles from 'virtual:globals-css-source';

vi.mock('server-only', () => ({}));

const profile = profileJson as Profile;
const sections = [
  ['identity', 'Identity'],
  ['intro', 'Introduction'],
  ['contributions', 'Contributions'],
  ['insights', 'Insights'],
  ['capabilities', 'Capabilities'],
  ['stack', 'Stack'],
  ['work', 'Selected work'],
  ['timeline', 'Timeline'],
  ['education', 'Education'],
  ['proof', 'Accolades'],
  ['products', 'Products'],
  ['brands', 'Worked with'],
  ['testimonials', 'Testimonials'],
  ['faq', 'FAQ'],
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

  it('renders all ten meaningful brand items once with pinned monochrome SVGs', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const brands = between(markup, '<section id="brands"', '<section id="testimonials"');

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
