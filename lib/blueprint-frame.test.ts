import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import Home from '@/app/page';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';
// @ts-expect-error The Vitest config exposes the stylesheet source as a virtual text module.
import styles from 'virtual:globals-css-source';

vi.mock('server-only', () => ({}));

const profile = profileJson as Profile;
const sectionIds = [
  'identity', 'intro', 'contributions', 'capabilities', 'stack', 'work',
  'timeline', 'education', 'proof', 'products', 'brands', 'faq', 'contact',
] as const;

function sectionMarkup(markup: string, id: (typeof sectionIds)[number]) {
  const index = sectionIds.indexOf(id);
  const start = markup.indexOf(`<section id="${id}"`);
  const nextId = sectionIds[index + 1];
  const end = nextId
    ? markup.indexOf(`<section id="${nextId}"`, start)
    : markup.indexOf('</main>', start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return markup.slice(start, end);
}

function expectClasses(markup: string, pattern: RegExp, classes: string[]) {
  const match = markup.match(pattern);
  expect(match).not.toBeNull();
  const className = match?.[1] ?? '';
  for (const classNamePart of classes) {
    expect(className.split(' ')).toContain(classNamePart);
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('blueprint frame', () => {
  it('renders rails, twelve section nodes, one CTA node pair, and three stitches', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const borderedSectionIds = sectionIds.filter((id) => id !== 'identity');

    expect(markup).toContain('<main class="bp-rails relative">');
    for (const id of borderedSectionIds) {
      const section = sectionMarkup(markup, id);
      expect(section.match(/^<section[^>]*class="[^"]*\bbp-nodes\b[^"]*"/))
        .not.toBeNull();
    }
    expect(sectionMarkup(markup, 'identity')).not.toMatch(/^<section[^>]*\bbp-nodes\b/);
    expect(markup.match(/\bbp-nodes\b/g)).toHaveLength(13);
    expect(markup).toMatch(/data-bookend-cta="true"[^>]*class="[^"]*\bbp-nodes\b/);
    expect(markup.match(/<div aria-hidden="true" class="bp-stitch"><\/div>/g)).toHaveLength(3);
  });

  it('defines responsive rail, node, stitch, anchor, and dimension primitives', () => {
    expect(styles).toMatch(/@media \(min-width: 80rem\) \{[\s\S]*?\.bp-rails::before,[\s\S]*?\.bp-rails::after/);
    expect(styles).toMatch(/\.bp-nodes::before,[\s\S]*?\.bp-nodes::after/);
    expect(styles).toMatch(/@media \(min-width: 80rem\) \{[\s\S]*?\.bp-nodes::before,[\s\S]*?\.bp-nodes::after \{ display: block; \}/);
    expect(styles).toContain('.bp-stitch {');
    expect(styles).toContain('.dossier-anchor {');
    expect(styles).toContain('.dim-mark {');
  });

  it('defines the branded 404 redaction-bar motif in dossier tokens', () => {
    expect(styles).toContain('.not-found-redactions {');
    expect(styles).toMatch(/\.not-found-redactions\s*\{[\s\S]*repeating-linear-gradient/);
    expect(styles).toMatch(/\.not-found-redactions\s*\{[\s\S]*var\(--text-1\)/);
  });

  it('defines dossier selection, six-pixel scrollbars, and CSS heatmap tooltips', () => {
    expect(styles).toMatch(/::selection\s*\{[\s\S]*background:\s*var\(--ring\)[\s\S]*color:\s*var\(--canvas\)/);
    expect(styles).toMatch(/scrollbar-width:\s*thin/);
    expect(styles).toMatch(/::-webkit-scrollbar\s*\{[\s\S]*width:\s*6px[\s\S]*height:\s*6px/);
    expect(styles).toMatch(/::-webkit-scrollbar-thumb\s*\{[\s\S]*var\(--text-3\)/);
    expect(styles).toMatch(/\.heatmap-cell::after\s*\{[\s\S]*content:\s*attr\(data-tooltip\)/);
    expect(styles).toMatch(/\.heatmap-cell:focus::after\s*\{\s*opacity:\s*1;?\s*\}/);
    expect(styles).toMatch(/:where\([^)]*\[tabindex\][^)]*\):focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--ring\)/);
  });
});

describe('hairline grids', () => {
  const gridClasses = [
    'gap-px', 'overflow-hidden', 'rounded-xl', 'border', 'border-line', 'bg-line',
  ];

  it('renders every capability skill in a flat hairline grid', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const capabilityMarkup = sectionMarkup(markup, 'capabilities');

    for (const act of profile.capabilities.acts) {
      const start = capabilityMarkup.indexOf(`data-skill-grid="${act.id}"`);
      const end = capabilityMarkup.indexOf('</ul>', start);
      const skillGrid = capabilityMarkup.slice(start, end);

      expectClasses(
        skillGrid,
        /data-skill-grid="[^"]+" class="([^"]+)"/,
        gridClasses,
      );
      expect(skillGrid.match(/<li\b/g)).toHaveLength(act.skills.length);
      expect(skillGrid).not.toContain('rounded-lg');
      expect(skillGrid).not.toContain('border border-line bg-surface/70');
      expect(skillGrid).toContain('bg-surface');
      expect(skillGrid).toContain('hover:bg-surface-hover');
      expect(skillGrid).toContain('transition-colors duration-150');
    }
  });

  it('renders education, products, and each accolades group as flat hairline grids', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const educationMarkup = sectionMarkup(markup, 'education');
    const productMarkup = sectionMarkup(markup, 'products');
    const proofMarkup = sectionMarkup(markup, 'proof');
    const educationEntries = profile.timeline.filter((entry) => entry.type === 'education');

    expectClasses(educationMarkup, /class="([^"]*mt-10 grid[^"]*)"/, gridClasses);
    expect(educationMarkup.match(/<article\b/g)).toHaveLength(educationEntries.length);
    expectClasses(productMarkup, /class="([^"]*mt-10 grid[^"]*)"/, gridClasses);
    expect(productMarkup.match(/data-product-card="true"/g)).toHaveLength(profile.products.length);

    const proofGroups = [
      ['Certifications', profile.proof_wall.certifications.length],
      ['Awards', profile.proof_wall.awards.length],
      ['CTF results', profile.proof_wall.ctf_results.length],
      ['Publications', profile.proof_wall.publications.length],
    ] as const;
    for (const [index, [title, itemCount]] of proofGroups.entries()) {
      const start = proofMarkup.indexOf(`>${title}</h3>`);
      const nextTitle = proofGroups[index + 1]?.[0];
      const end = nextTitle ? proofMarkup.indexOf(`>${nextTitle}</h3>`, start) : proofMarkup.length;
      const groupMarkup = proofMarkup.slice(start, end);

      expectClasses(groupMarkup, /class="([^"]*mt-5 grid[^"]*)"/, gridClasses);
      expect(groupMarkup.match(/data-proof-tile="true"/g)).toHaveLength(itemCount);
    }

    for (const flatSectionMarkup of [educationMarkup, productMarkup, proofMarkup]) {
      expect(flatSectionMarkup).not.toContain('dossier-card');
      expect(flatSectionMarkup).not.toContain('rounded-[14px]');
      expect(flatSectionMarkup).toContain('bg-surface');
      expect(flatSectionMarkup).toContain('hover:bg-surface-hover');
      expect(flatSectionMarkup).toContain('transition-colors duration-150');
    }
  });
});

describe('FAQ and narrative bookend', () => {
  it('renders a sticky FAQ split with email and assistant escape hatches', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const faqMarkup = sectionMarkup(markup, 'faq');

    expectClasses(
      faqMarkup,
      /class="([^"]*grid gap-px[^"]*)"/,
      ['grid', 'gap-px', 'overflow-hidden', 'md:overflow-clip', 'rounded-xl', 'border', 'border-line', 'bg-line', 'md:grid-cols-2'],
    );
    expect(faqMarkup).toContain('md:sticky md:top-24');
    expect(faqMarkup).toContain(`href="mailto:${profile.identity.email}"`);
    expect(faqMarkup).toContain('href="#contact"');
    expect(faqMarkup).toContain('ask the assistant');
    expect(faqMarkup.match(/<details data-faq-entry="true"/g)).toHaveLength(profile.faq.length);
    expect(faqMarkup).not.toContain('border-y border-line');
  });

  it('places the derived bookend after Contact without adding a section or figure', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const contactStart = markup.indexOf('<section id="contact"');
    const bookendStart = markup.indexOf('data-bookend-cta="true"');
    const mainEnd = markup.indexOf('</main>', bookendStart);
    const bookendMarkup = markup.slice(bookendStart, mainEnd);
    const keywords = profile.identity.tagline.split('.').map((word) => word.trim()).filter(Boolean);

    expect(bookendStart).toBeGreaterThan(contactStart);
    expect(markup.slice(contactStart, bookendStart)).toMatch(/<div aria-hidden="true" class="bp-stitch"><\/div>\s*<div\s*$/);
    expect(bookendMarkup).toContain('One dossier. ');
    for (const keyword of keywords) {
      expect(bookendMarkup).toContain(`<span class="text-text-1">${keyword}.</span>`);
    }
    expect(bookendMarkup).toContain('href="#contact"');
    expect(bookendMarkup).toContain('>Get in touch</a>');
    expect(bookendMarkup).toContain('href="#work"');
    expect(bookendMarkup).toContain('>Selected work</a>');
    expect(bookendMarkup).not.toContain('<section');
    expect(bookendMarkup).not.toContain('fig-label');
  });
});

describe('section anchors, brand markers, and dimension tags', () => {
  it('puts a self-link inside every visible section h2 except Contributions', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const anchoredIds = [
      'intro', 'capabilities', 'stack', 'work', 'timeline', 'education',
      'proof', 'products', 'brands', 'faq', 'contact',
    ] as const;

    for (const id of anchoredIds) {
      const currentSectionMarkup = sectionMarkup(markup, id);
      expect(currentSectionMarkup).toMatch(
        new RegExp(`<h2[\\s\\S]*?<a href="#${id}" class="dossier-anchor"[^>]*>#[\\s\\S]*?<\\/h2>`),
      );
    }
    expect(sectionMarkup(markup, 'contributions')).not.toContain('dossier-anchor');
  });

  it('renders exactly four hidden blueprint plus markers on the brands wall', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const brandsMarkup = sectionMarkup(markup, 'brands');
    const hiddenSvgs = brandsMarkup.match(/<svg\b(?=[^>]*aria-hidden="true")[^>]*>[\s\S]*?<\/svg>/g) ?? [];

    expect(hiddenSvgs).toHaveLength(4);
    expect(brandsMarkup.match(/<path d="M5 12h14"><\/path>/g)).toHaveLength(4);
    expect(brandsMarkup.match(/<path d="M12 5v14"><\/path>/g)).toHaveLength(4);
  });

  it('marks every work, product, and education period as a dimension', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const periodGroups = [
      ['work', profile.work_cases.map((entry) => entry.period)],
      ['products', profile.products.flatMap((entry) => entry.period ? [entry.period] : [])],
      ['education', profile.timeline.filter((entry) => entry.type === 'education').map((entry) => entry.period)],
    ] as const;

    for (const [id, periods] of periodGroups) {
      const currentSectionMarkup = sectionMarkup(markup, id);
      expect(currentSectionMarkup.match(/class="[^"]*\bdim-mark\b[^"]*"/g)).toHaveLength(periods.length);
      for (const period of periods) {
        expect(currentSectionMarkup).toMatch(
          new RegExp(`<p class="[^"]*\\bdim-mark\\b[^"]*">${escapeRegExp(period)}<\\/p>`),
        );
      }
    }
  });
});
