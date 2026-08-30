import { createElement, Fragment } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Footer } from '@/components/footer';
import { IdentityHeader } from '@/components/sections/identity-header';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';

const profile = profileJson as Profile;

describe('identity header', () => {
  it('renders the portrait and a runtime monogram fallback without a filesystem prop', () => {
    const markup = renderToStaticMarkup(
      createElement(IdentityHeader, { profile }),
    );

    expect(markup).toContain(`src="${profile.identity.portrait.image}"`);
    expect(markup).toContain(`alt="${profile.identity.portrait.alt}"`);
    expect(markup).toContain('loading="lazy"');
    expect(markup).not.toContain('fetchpriority=');
    expect(markup).toContain(`${profile.identity.name} monogram`);
  });

  it('keeps the final name and verified badge in one non-wrapping unit', () => {
    const markup = renderToStaticMarkup(
      createElement(IdentityHeader, { profile }),
    );

    expect(markup).toContain('whitespace-nowrap inline-flex');
    expect(markup).toMatch(/Tanyory<\/span>.*aria-label="verified"/);
  });

  it('provides a downloadable resume from the dossier', () => {
    const markup = renderToStaticMarkup(
      createElement(IdentityHeader, { profile }),
    );

    expect(markup).toContain('href="/media/resume.pdf"');
    expect(markup).toContain('download=""');
  });

  it('renders an accessible xl-only isometric ZST blueprint mark', () => {
    const markup = renderToStaticMarkup(
      createElement(IdentityHeader, { profile }),
    );
    const markStart = markup.indexOf('data-zst-hero-mark="true"');
    const markEnd = markup.indexOf('</a>', markStart);
    const markMarkup = markup.slice(markStart, markEnd);

    expect(markStart).toBeGreaterThanOrEqual(0);
    expect(markEnd).toBeGreaterThan(markStart);
    expect(markMarkup).toContain('href="#identity"');
    expect(markMarkup).toContain('aria-label="Return to top"');
    expect(markMarkup).toContain('hidden');
    expect(markMarkup).toContain('xl:flex');
    expect(markMarkup).toMatch(/opacity-/);
    expect(markMarkup).toContain('<svg');
    expect(markMarkup).toContain('aria-hidden="true"');
    expect(markMarkup).toContain('data-zst-line-art="true"');
    expect(markMarkup).toContain('zst-blueprint-line-art');
    expect(markMarkup).not.toContain('<img');
  });
});

describe('footer', () => {
  it('links to the resume', () => {
    const markup = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(Footer, { name: profile.identity.name }),
      ),
    );

    expect(markup).toContain('href="/media/resume.pdf"');
  });
});
