import { createElement } from 'react';
import type { ComponentType } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const notFoundModule = await import('@/app/not-found').catch(() => ({}));

describe('branded not found page', () => {
  it('renders the dossier missing-document treatment and correct title', () => {
    const NotFound = Reflect.get(notFoundModule, 'default') as ComponentType | undefined;

    expect(NotFound).toBeTypeOf('function');
    if (typeof NotFound !== 'function') return;

    const markup = renderToStaticMarkup(createElement(NotFound));
    expect(markup).toContain('<title>Page Not Found</title>');
    expect(markup).toContain('FIG. 404. MISSING DOCUMENT');
    expect(markup).toContain('data-redaction-bar="true"');
    expect(markup).toContain('href="/"');
    expect(markup).toContain('Return to the dossier');
    expect(markup.toLowerCase()).not.toContain('game');
  });
});
