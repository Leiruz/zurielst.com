import { createElement } from 'react';
import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { Footer } from '@/components/footer';
import { enhanceContributionGraph } from '@/components/registry/contribution-graph';
import type { ContributionSnapshot } from '@/components/registry/github-contributions';
import { GitHubContributionsFigure } from '@/components/sections/github-contributions';
import contributionJson from '@/content/github-contributions.json';
import packageJson from '@/package.json';

const notFoundModule = await import('@/app/not-found').catch(() => ({}));
const notFoundGameLoaderModule = await import('@/components/registry/not-found-game-loader').catch(() => ({}));
const footerTriggerModule = await import('@/components/footer-terminal-trigger').catch(() => ({}));

describe('branded not found page', () => {
  it('renders the static ZST missing-document treatment and home route', () => {
    const NotFound = Reflect.get(notFoundModule, 'default') as ComponentType | undefined;

    expect(NotFound).toBeTypeOf('function');
    if (typeof NotFound !== 'function') return;

    const markup = renderToStaticMarkup(createElement(NotFound));
    expect(markup).toContain('<title>Page Not Found</title>');
    expect(markup).toContain('FIG. 404. MISSING DOCUMENT');
    expect(markup).toContain('data-not-found-mark="true"');
    expect(markup).toContain('ZST');
    expect(markup).toContain('The requested record is absent.');
    expect(markup).toContain('data-redaction-bar="true"');
    expect(markup).toContain('href="/"');
    expect(markup).toContain('Return to the dossier');
  });

  it('extracts the optional game into a dedicated client loader', () => {
    expect(Reflect.get(notFoundGameLoaderModule, 'NotFoundGameLoader')).toBeTypeOf('function');
  });
});

describe('registry contribution graph finishers', () => {
  it('renders month labels, dossier legend, labelled cells, and the exact snapshot caption', () => {
    const data = contributionJson as ContributionSnapshot;
    const markup = renderToStaticMarkup(createElement(GitHubContributionsFigure, { snapshot: data }));
    const monthLabels = [...markup.matchAll(/data-month-label="true"[^>]*>([^<]+)</g)]
      .map((match) => match[1]);
    const contributionDays = data.weeks.flatMap((week) => week.contributionDays);
    const cellTags = [...markup.matchAll(/<g[^>]*class="contribution-cell"[^>]*>/g)]
      .map((match) => match[0]);
    const regionTag = markup.match(/<div[^>]*role="region"[^>]*>/)?.[0] ?? '';

    expect(monthLabels).toEqual([
      'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb',
      'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug',
    ]);
    expect(markup).toContain('data-contribution-legend="true"');
    expect(markup).toContain('>Less</span>');
    expect(markup).toContain('>More</span>');
    expect(markup.match(/data-legend-level="[0-4]"/g)).toHaveLength(5);
    expect(cellTags).toHaveLength(contributionDays.length);
    expect(cellTags.filter((tag) => tag.includes('tabindex="0"'))).toHaveLength(1);
    expect(cellTags.filter((tag) => tag.includes('tabindex="-1"'))).toHaveLength(contributionDays.length - 1);
    expect(cellTags.every((tag) => tag.includes('role="img"') && tag.includes('aria-label="'))).toBe(true);
    expect(regionTag).not.toContain('tabindex=');
    expect(regionTag).toContain('304 contributions in the last year, shown across 53 weeks.');
    expect(markup).toContain(
      'Fig. 2. 304 contributions in the last year. Source: github.com/Leiruz, committed build-time snapshot.',
    );
    expect(markup).not.toContain('<section');
  });

  it('moves the roving tab stop with arrow keys and keeps boundary focus in place', () => {
    interface TestEvent {
      key?: string;
      preventDefault?: () => void;
      target: FakeCell;
    }
    interface FakeCell {
      attributes: Map<string, string>;
      closest(selector: string): FakeCell | null;
      focus(): void;
      getAttribute(name: string): string | null;
      setAttribute(name: string, value: string): void;
    }
    const listeners = new Map<string, (event: TestEvent) => void>();
    const cells = new Map<string, FakeCell>();
    let focusedCell: FakeCell | undefined;

    function makeCell(
      week: number,
      day: number,
      tooltip: string,
      tabIndex: string,
    ): FakeCell {
      const attributes = new Map<string, string>([
        ['aria-label', tooltip],
        ['data-contribution-day', String(day)],
        ['data-contribution-week', String(week)],
        ['data-contribution-cell', 'true'],
        ['tabindex', tabIndex],
      ]);
      const cell: FakeCell = {
        attributes,
        closest: (selector) => selector.includes('[data-contribution-cell]') ? cell : null,
        focus: vi.fn(() => {
          focusedCell = cell;
          listeners.get('focusin')?.({ target: cell });
        }),
        getAttribute: (name) => attributes.get(name) ?? null,
        setAttribute: (name, value) => {
          attributes.set(name, value);
        },
      };
      cells.set(`${week}:${day}`, cell);
      return cell;
    }

    const first = makeCell(0, 0, '2026-08-16: 1 contributions', '0');
    const destination = makeCell(1, 0, '2026-08-23: 3 contributions', '-1');
    makeCell(0, 1, '2026-08-17: 2 contributions', '-1');
    makeCell(1, 1, '2026-08-24: 4 contributions', '-1');
    makeCell(2, 0, '2026-08-30: 17 contributions', '-1');
    const root = {
      addEventListener(type: string, listener: (event: TestEvent) => void) {
        listeners.set(type, listener);
      },
      querySelector(selector: string) {
        if (selector.includes('[tabindex="0"]')) {
          return [...cells.values()].find((cell) => cell.getAttribute('tabindex') === '0') ?? null;
        }
        const week = selector.match(/data-contribution-week="(\d+)"/)?.[1];
        const day = selector.match(/data-contribution-day="(\d+)"/)?.[1];
        return week !== undefined && day !== undefined
          ? cells.get(`${week}:${day}`) ?? null
          : null;
      },
    };
    const preventDefault = vi.fn();

    enhanceContributionGraph(root);
    listeners.get('keydown')?.({
      key: 'ArrowRight',
      preventDefault,
      target: first,
    });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(focusedCell).toBe(destination);
    expect(first.getAttribute('tabindex')).toBe('-1');
    expect(destination.getAttribute('tabindex')).toBe('0');
    expect(focusedCell?.getAttribute('aria-label')).toBe('2026-08-23: 3 contributions');

    const boundaryPreventDefault = vi.fn();
    listeners.get('keydown')?.({
      key: 'ArrowUp',
      preventDefault: boundaryPreventDefault,
      target: destination,
    });
    expect(boundaryPreventDefault).toHaveBeenCalledOnce();
    expect(focusedCell).toBe(destination);
  });
});

describe('footer document control', () => {
  it('renders the factual seven-cell colophon with build provenance', () => {
    const sha = '1234567890abcdef1234567890abcdef12345678';
    const markup = renderToStaticMarkup(createElement(Footer as ComponentType<{
      buildDate: string;
      buildSha: string;
      socials: Array<{ platform: 'GitHub' | 'LinkedIn'; url: string }>;
    }>, {
      buildDate: '2026-08-31T04:05:06.000Z',
      buildSha: sha,
      socials: [
        { platform: 'GitHub', url: 'https://github.com/Leiruz' },
        { platform: 'LinkedIn', url: 'https://www.linkedin.com/in/zuriel-shanley/' },
      ],
    }));
    const text = markup.replace(/<[^>]+>/g, '').replaceAll('&#x27;', "'");

    expect(text).toContain('zurielst.com');
    expect(text).toContain('An engineered dossier for AI and automation in security.');
    const labels = ['CRAFTED BY', 'BUILD', 'DATE', 'SOURCE CODE', 'STACK', 'TYPEFACE', 'ANALYTICS'];
    expect(markup.match(/data-colophon-cell="true"/g)).toHaveLength(labels.length);
    expect(markup.match(/data-colophon-label="true"/g)).toHaveLength(labels.length);
    for (const label of labels) {
      expect(text).toContain(label);
    }
    expect(markup).toContain('href="https://github.com/Leiruz"');
    expect(text).toContain('@Leiruz');
    expect(markup).toContain(`href="https://github.com/Leiruz/zurielst.com/commit/${sha}"`);
    expect(markup).toContain('>1234567</a>');
    expect(markup).toContain('dateTime="2026-08-31"');
    expect(markup).toContain('href="https://github.com/Leiruz/zurielst.com"');
    for (const [name, version] of [
      ['next', packageJson.dependencies.next],
      ['react', packageJson.dependencies.react],
      ['tailwindcss', packageJson.devDependencies.tailwindcss],
    ]) {
      expect(text).toContain(`${name}@${version.replace(/^[^\d]*/, '')}`);
    }
    expect(text).toContain('Geist');
    expect(text).toContain('Cloudflare Web Analytics');
    expect(markup).toContain('data-footer-mark="true"');
    expect(text).toContain('ZST');
    expect(markup.match(/data-footer-social="true"/g)).toHaveLength(2);
    expect(markup).toContain('aria-label="GitHub"');
    expect(markup).toContain('aria-label="LinkedIn"');
    expect(markup.match(/data-footer-social="true"[\s\S]*?<svg/g)).toBeTruthy();
    expect(markup).toContain('focus-visible:ring-2');
    expect(markup).toContain('grid-cols-1');
    expect(markup).toContain('sm:grid-cols-2');

    for (const prohibited of [
      'Cloudflare Workers',
      "Built with components from ncdai's registry (MIT)",
      'chanhdai',
      'DMCA',
      'INSPIRED BY',
    ]) {
      expect(text).not.toContain(prohibited);
    }
  });

  it('extracts the terminal opener into a dedicated client island', () => {
    expect(Reflect.get(footerTriggerModule, 'FooterTerminalTrigger')).toBeTypeOf('function');
  });

  it('renders a non-SHA build fallback as plain text', () => {
    const markup = renderToStaticMarkup(createElement(Footer as ComponentType<{
      buildDate: string;
      buildSha: string;
      socials: Array<{ platform: 'GitHub' | 'LinkedIn'; url: string }>;
    }>, {
      buildDate: '2026-08-31T04:05:06.000Z',
      buildSha: 'dev',
      socials: [],
    }));

    expect(markup).toContain('>dev</dd>');
    expect(markup).not.toContain('/commit/dev');
    expect(markup).not.toContain('>dev</a>');
  });
});
