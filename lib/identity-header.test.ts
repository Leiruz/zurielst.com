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
    expect(markup).toMatch(
      /<img(?=[^>]*loading="eager")(?=[^>]*fetchPriority="high")(?=[^>]*decoding="async")/,
    );
    expect(markup).toContain(`${profile.identity.name} monogram`);
  });

  it('keeps the final name and verified badge in one non-wrapping unit', () => {
    const markup = renderToStaticMarkup(
      createElement(IdentityHeader, { profile }),
    );

    expect(markup).toContain('whitespace-nowrap inline-flex');
    expect(markup).toMatch(/Tanyory<\/span>.*aria-label="verified"/);
  });

  it('provides a downloadable resume beside the socials and in the dossier', () => {
    const markup = renderToStaticMarkup(
      createElement(IdentityHeader, { profile }),
    );

    expect(markup.match(/href="\/media\/resume\.pdf"/g)).toHaveLength(2);
    expect(markup.match(/download=""/g)).toHaveLength(2);
    expect(markup).toMatch(/data-identity-socials="true"[\s\S]*href="\/media\/resume\.pdf"[^>]*download=""[^>]*>Resume<\/a>/);
  });

  it('tracks only outbound social profile links', () => {
    const markup = renderToStaticMarkup(
      createElement(IdentityHeader, { profile }),
    );

    for (const social of profile.identity.socials) {
      expect(markup).toContain(`href="${social.url}?utm_source=zurielst.com"`);
      expect(markup).not.toContain(`href="${social.url}"`);
    }
    expect(markup).toContain('href="/media/resume.pdf"');
    expect(markup).not.toContain('/media/resume.pdf?utm_source=');
  });

  it('omits the landing-page ZST background mark and its third layout column', () => {
    const markup = renderToStaticMarkup(
      createElement(IdentityHeader, { profile }),
    );

    expect(markup).not.toContain('data-zst-hero-mark');
    expect(markup).not.toContain('data-zst-line-art');
    expect(markup).not.toContain('xl:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.75fr)_minmax(12rem,0.4fr)]');
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
