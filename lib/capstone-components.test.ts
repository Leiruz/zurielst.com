import { createElement } from 'react';
import type { ComponentType } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Footer } from '@/components/footer';
import { ContributionHeatmap, type ContributionSnapshot } from '@/components/sections/contribution-heatmap';
import contributionJson from '@/content/github-contributions.json';

const notFoundModule = await import('@/app/not-found').catch(() => ({}));
const footerTriggerModule = await import('@/components/footer-terminal-trigger').catch(() => ({}));

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

describe('contribution heatmap finishers', () => {
  it('renders month labels, opacity legend, CSS tooltip hooks, and the exact snapshot caption', () => {
    const data = contributionJson as ContributionSnapshot;
    const markup = renderToStaticMarkup(createElement(ContributionHeatmap, { data }));
    const monthLabels = [...markup.matchAll(/data-month-label="true"[^>]*>([^<]+)<\/span>/g)]
      .map((match) => match[1]);
    const contributionDays = data.weeks.flatMap((week) => week.contributionDays);

    expect(monthLabels).toEqual([
      'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb',
      'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug',
    ]);
    expect(markup).toContain('data-heat-legend="true"');
    expect(markup).toContain('>Less</span>');
    expect(markup).toContain('>More</span>');
    expect(markup.match(/data-legend-level="[0-4]"/g)).toHaveLength(5);
    expect(markup.match(/data-tooltip="/g)).toHaveLength(contributionDays.length);
    expect(markup).not.toContain(' title="');
    expect(markup).toContain(
      'Fig. 3. 304 contributions in the last year. Source: github.com/Leiruz, committed build-time snapshot.',
    );
  });
});

describe('footer document control', () => {
  it('renders build provenance as a server dossier table', () => {
    const sha = '1234567890abcdef1234567890abcdef12345678';
    const markup = renderToStaticMarkup(createElement(Footer as ComponentType<{
      buildDate: string;
      buildSha: string;
      name: string;
    }>, {
      buildDate: '2026-08-31T04:05:06.000Z',
      buildSha: sha,
      name: 'Test Person',
    }));
    const text = markup.replace(/<[^>]+>/g, '').replaceAll('&#x27;', "'");

    expect(markup).toContain('DOCUMENT CONTROL');
    for (const label of ['BUILD', 'DATE', 'DEPLOYED ON', 'SOURCE', 'LICENSE', 'TYPEFACES']) {
      expect(markup).toContain(`<dt`);
      expect(text).toContain(label);
    }
    expect(markup).toContain(`href="https://github.com/Leiruz/zurielst.com/commit/${sha}"`);
    expect(markup).toContain('>1234567</a>');
    expect(markup).toContain('dateTime="2026-08-31"');
    expect(text).toContain('Cloudflare Workers');
    expect(text).toContain('MIT');
    expect(text).toContain('Geist and Geist Mono');
    expect(text).toContain("Built with components from ncdai's registry (MIT)");
  });

  it('extracts the terminal opener into a dedicated client island', () => {
    expect(Reflect.get(footerTriggerModule, 'FooterTerminalTrigger')).toBeTypeOf('function');
  });
});
