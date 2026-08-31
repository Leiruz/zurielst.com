import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';

vi.mock('server-only', () => ({}));

const profile = profileJson as Profile;

const expectedSectionIds = [
  'identity', 'intro', 'brands', 'capabilities', 'stack', 'work', 'timeline',
  'education', 'proof', 'products', 'testimonials', 'faq', 'insights', 'contact',
];

const expectedFigureLabels = [
  'Identity', 'Introduction', 'Worked with', 'Capabilities', 'Stack', 'Selected work',
  'Timeline', 'Education', 'Accolades', 'Products', 'Testimonials', 'FAQ', 'Insights',
  'Contact',
];

function expectRenderedText(markup: string, value: string) {
  const encodedValue = renderToStaticMarkup(createElement('span', null, value)).replace(/^<span>|<\/span>$/g, '');
  expect(markup).toContain(encodedValue);
}

describe('final dossier sections', () => {
  it('server-renders accolades without extras, plus products and FAQ from the complete profile', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const productsMarkup = markup.slice(
      markup.indexOf('<section id="products"'),
      markup.indexOf('<section id="testimonials"'),
    );
    const accoladeItems = [
      ...profile.proof_wall.certifications,
      ...profile.proof_wall.awards,
      ...profile.proof_wall.ctf_results,
      ...profile.proof_wall.publications,
    ];

    for (const [id, label] of [
      ['brands', 'Fig. 3. Worked with'],
      ['proof', 'Fig. 9. Accolades'],
      ['products', 'Fig. 10. Products'],
      ['testimonials', 'Fig. 11. Testimonials'],
      ['faq', 'Fig. 12. FAQ'],
      ['insights', 'Fig. 13. Insights'],
      ['contact', 'Fig. 14. Contact'],
    ] as const) {
      expect(markup).toContain(`id="${id}"`);
      expect(markup).toContain(label);
    }

    for (const item of accoladeItems) expectRenderedText(markup, item.title);
    for (const product of profile.products) expectRenderedText(markup, product.name);
    for (const entry of profile.faq) expectRenderedText(markup, entry.question);

    expect(profile.proof_wall.extras.length).toBeGreaterThan(0);
    expect(markup.match(/data-proof-tile="true"/g)).toHaveLength(accoladeItems.length);
    expect(productsMarkup.match(/data-slot="glow-card-grid"/g)).toHaveLength(1);
    expect(productsMarkup.match(/data-slot="glow-card"/g)).toHaveLength(profile.products.length);
    expect(productsMarkup.match(/data-product-card="true"/g)).toHaveLength(profile.products.length);
    expect(productsMarkup.match(/tabindex="0"/g)).toHaveLength(profile.products.length);
    expect(markup.match(/<details data-faq-entry="true"/g)).toHaveLength(profile.faq.length);
    expect(markup).toContain('Origin story');

    for (const extra of profile.proof_wall.extras) {
      const encodedTitle = renderToStaticMarkup(createElement('span', null, extra.title)).replace(/^<span>|<\/span>$/g, '');
      expect(markup).not.toContain(encodedTitle);
      expect(markup).not.toContain(`src="${extra.media}"`);
      expect(markup).not.toContain(extra.caption ?? '__missing-caption__');
    }
    expect(markup).not.toContain('Artifacts');
    expect(markup).not.toContain('Video artifact');
    expect(markup).not.toContain('Image artifact');
    expect(markup).toMatch(/href="\/zurielst\.vcf"[^>]*download=""/);
    for (const social of profile.identity.socials) {
      expect(markup).toContain(`href="${social.url}?utm_source=zurielst.com"`);
    }
    expect(markup).not.toContain('/zurielst.vcf?utm_source=');
  });

  it('keeps one exact figure label inside each top-level section', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const sectionIds = [...markup.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)]
      .map((match) => match[1]);

    expect(sectionIds).toEqual(expectedSectionIds);
    for (const [index, label] of expectedFigureLabels.entries()) {
      const sectionStart = markup.indexOf(`<section id="${expectedSectionIds[index]}"`);
      const nextSectionStart = index === expectedSectionIds.length - 1
        ? markup.indexOf('</main>', sectionStart)
        : markup.indexOf(`<section id="${expectedSectionIds[index + 1]}"`, sectionStart);
      const sectionMarkup = markup.slice(sectionStart, nextSectionStart);
      const figureLabels = [...sectionMarkup.matchAll(
        /<[^>]+class="[^"]*\bfig-label\b[^"]*"[^>]*>\s*(Fig\. \d+\. [^<]+)\s*</g,
      )].map((match) => match[1]);

      expect(sectionMarkup).not.toBe('');
      expect(figureLabels).toEqual([`Fig. ${index + 1}. ${label}`]);
    }
  });
});
