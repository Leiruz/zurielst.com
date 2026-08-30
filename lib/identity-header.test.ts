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
