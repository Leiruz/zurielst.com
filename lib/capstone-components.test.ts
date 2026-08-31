import { createElement } from 'react';
import type { ComponentType } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { Footer } from '@/components/footer';
import { enhanceContributionGraph } from '@/components/registry/contribution-graph';
import type { ContributionSnapshot } from '@/components/registry/github-contributions';
import { GitHubContributionsSection } from '@/components/sections/github-contributions';
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

describe('registry contribution graph finishers', () => {
  it('renders month labels, dossier legend, labelled cells, and the exact snapshot caption', () => {
    const data = contributionJson as ContributionSnapshot;
    const markup = renderToStaticMarkup(createElement(GitHubContributionsSection, { snapshot: data }));
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
      'Fig. 3. 304 contributions in the last year. Source: github.com/Leiruz, committed build-time snapshot.',
    );
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

  it('renders a non-SHA build fallback as plain text', () => {
    const markup = renderToStaticMarkup(createElement(Footer as ComponentType<{
      buildDate: string;
      buildSha: string;
      name: string;
    }>, {
      buildDate: '2026-08-31T04:05:06.000Z',
      buildSha: 'unknown',
      name: 'Test Person',
    }));

    expect(markup).toContain('>unknown</dd>');
    expect(markup).not.toContain('/commit/unknown');
    expect(markup).not.toContain('>unknown</a>');
  });
});
