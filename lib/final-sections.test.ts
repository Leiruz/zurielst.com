import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';

vi.mock('server-only', () => ({}));

const profile = profileJson as Profile;

function expectRenderedText(markup: string, value: string) {
  const encodedValue = renderToStaticMarkup(createElement('span', null, value)).replace(/^<span>|<\/span>$/g, '');
  expect(markup).toContain(encodedValue);
}

describe('final dossier sections', () => {
  it('server-renders accolades without extras, plus products and FAQ from the complete profile', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const accoladeItems = [
      ...profile.proof_wall.certifications,
      ...profile.proof_wall.awards,
      ...profile.proof_wall.ctf_results,
      ...profile.proof_wall.publications,
    ];

    for (const [id, label] of [
      ['proof', 'Fig. 10. Accolades'],
      ['products', 'Fig. 11. Products'],
      ['faq', 'Fig. 12. FAQ'],
      ['contact', 'Fig. 13. Contact'],
    ] as const) {
      expect(markup).toContain(`id="${id}"`);
      expect(markup).toContain(label);
    }

    for (const item of accoladeItems) expectRenderedText(markup, item.title);
    for (const product of profile.products) expectRenderedText(markup, product.name);
    for (const entry of profile.faq) expectRenderedText(markup, entry.question);

    expect(profile.proof_wall.extras.length).toBeGreaterThan(0);
    expect(markup.match(/data-proof-tile="true"/g)).toHaveLength(accoladeItems.length);
    expect(markup.match(/data-product-card="true"/g)).toHaveLength(profile.products.length);
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
  });

  it('numbers the thirteen top-level figure labels in exact order', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const figureNumbers = [...markup.matchAll(
      /<[^>]+class="[^"]*\bfig-label\b[^"]*"[^>]*>\s*Fig\. (\d+)\./g,
    )].map((match) => Number(match[1]));

    expect(figureNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });
});
