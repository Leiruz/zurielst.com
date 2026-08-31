import { createElement } from 'react';
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
  'identity', 'intro', 'brands', 'capabilities', 'stack', 'work', 'timeline',
  'education', 'proof', 'products', 'testimonials', 'faq', 'insights', 'contact',
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

describe('chanhdai dossier direction', () => {
  it('omits the efferd frame, nodes, stitches, dimensions, and brand corner markers', () => {
    const markup = renderToStaticMarkup(createElement(Home));

    expect(markup).not.toMatch(/\bbp-(?:rails|nodes|stitch)\b/);
    expect(markup).not.toMatch(/\bdim-mark\b/);
    expect(markup).not.toContain('<path d="M5 12h14"></path>');
    expect(markup).not.toContain('<path d="M12 5v14"></path>');
    expect(styles).not.toMatch(/\.bp-(?:rails|nodes|stitch)\b/);
    expect(styles).not.toContain('.dim-mark {');
  });

  it('keeps the dossier selection, scrollbars, contribution focus, and heading anchors', () => {
    expect(styles).toMatch(/::selection\s*\{[\s\S]*background:\s*var\(--ring\)[\s\S]*color:\s*var\(--canvas\)/);
    expect(styles).toMatch(/scrollbar-width:\s*thin/);
    expect(styles).toMatch(/::-webkit-scrollbar\s*\{[\s\S]*width:\s*6px[\s\S]*height:\s*6px/);
    expect(styles).toContain('.contribution-cell:focus-visible');
    expect(styles).not.toContain('.heatmap-cell::after');
    expect(styles).toContain('.dossier-anchor {');

    const markup = renderToStaticMarkup(createElement(Home));
    const anchoredIds = [
      'intro', 'brands', 'capabilities', 'stack', 'work', 'timeline', 'education',
      'proof', 'products', 'testimonials', 'faq', 'insights', 'contact',
    ] as const;
    for (const id of anchoredIds) {
      expect(sectionMarkup(markup, id)).toMatch(
        new RegExp(`<h2[\\s\\S]*?<a href="#${id}" class="dossier-anchor"[^>]*>#[\\s\\S]*?<\\/h2>`),
      );
    }
  });

  it('restores individual capability, education, product, and accolade cards', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const capabilityMarkup = sectionMarkup(markup, 'capabilities');

    for (const act of profile.capabilities.acts) {
      const start = capabilityMarkup.indexOf(`data-skill-grid="${act.id}"`);
      const end = capabilityMarkup.indexOf('</ul>', start);
      const skillGrid = capabilityMarkup.slice(start, end);
      expectClasses(skillGrid, /data-skill-grid="[^"]+" class="([^"]+)"/, ['grid', 'gap-2']);
      expect(skillGrid).toContain('rounded-lg border border-line bg-surface/70');
      expect(skillGrid).not.toContain('gap-px');
    }

    const educationMarkup = sectionMarkup(markup, 'education');
    const productMarkup = sectionMarkup(markup, 'products');
    const proofMarkup = sectionMarkup(markup, 'proof');
    expectClasses(educationMarkup, /class="([^"]*mt-10 grid[^"]*)"/, ['grid', 'gap-4']);
    expect(educationMarkup).toContain('dossier-card');
    expectClasses(
      productMarkup,
      /data-slot="glow-card-grid" class="([^"]+)"/,
      ['glow-card-grid', 'grid', 'gap-4', 'mt-10'],
    );
    expect(productMarkup).toContain('dossier-card');

    for (const title of ['Certifications', 'Awards', 'CTF results', 'Publications']) {
      const start = proofMarkup.indexOf(`>${title}</h3>`);
      const groupMarkup = proofMarkup.slice(start, proofMarkup.indexOf('</section>', start));
      expectClasses(groupMarkup, /class="([^"]*mt-5 grid[^"]*)"/, ['grid', 'gap-4']);
      expect(groupMarkup).toContain('rounded-[14px] border border-line bg-surface');
    }
  });

  it('restores the simple FAQ while retaining its anchor and every answer', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const faqMarkup = sectionMarkup(markup, 'faq');

    expect(faqMarkup).toContain('mt-10 max-w-4xl');
    expect(faqMarkup).toContain('divide-y divide-line border-y border-line');
    expect(faqMarkup).toContain('href="#faq"');
    expect(faqMarkup.match(/<details data-faq-entry="true"/g)).toHaveLength(profile.faq.length);
    expect(faqMarkup).not.toContain('md:sticky');
    expect(faqMarkup).not.toContain('md:grid-cols-2');
    expect(faqMarkup).not.toContain('ask the assistant');
  });

  it('keeps the bookend after Contact without adding a section or figure', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const contactStart = markup.indexOf('<section id="contact"');
    const bookendStart = markup.indexOf('data-bookend-cta="true"');
    const mainEnd = markup.indexOf('</main>', bookendStart);
    const bookendMarkup = markup.slice(bookendStart, mainEnd);

    expect(bookendStart).toBeGreaterThan(contactStart);
    expect(bookendMarkup).toContain('One dossier. ');
    expect(bookendMarkup).toContain('href="#contact"');
    expect(bookendMarkup).toContain('>Get in touch</a>');
    expect(bookendMarkup).toContain('href="#work"');
    expect(bookendMarkup).toContain('>Selected work</a>');
    expect(bookendMarkup).not.toContain('<section');
    expect(bookendMarkup).not.toContain('fig-label');
  });
});

describe('existing dossier motifs', () => {
  it('keeps the branded 404 mark, game surface, and accessible focus ring', () => {
    expect(styles).toContain('.not-found-redactions {');
    expect(styles).toMatch(/\.not-found-redactions\s*\{[\s\S]*repeating-linear-gradient/);
    expect(styles).toMatch(/\.not-found-mark\s*\{[\s\S]*font-family:\s*var\(--font-mono\)/);
    expect(styles).toMatch(/\.not-found-game-canvas\s*\{[\s\S]*touch-action:\s*none/);
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.not-found-game-shell/);
    expect(styles).toMatch(/:where\([^)]*\[tabindex\][^)]*\):focus-visible\s*\{[\s\S]*outline:\s*2px solid var\(--ring\)/);
  });
});
