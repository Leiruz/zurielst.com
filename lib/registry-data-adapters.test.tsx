import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error Vite exposes source files through its raw query during tests.
import githubSource from '../components/registry/github-contributions.tsx?raw';
// @ts-expect-error Vite exposes source files through its raw query during tests.
import graphSource from '../components/registry/contribution-graph.tsx?raw';
// @ts-expect-error Vite exposes source files through its raw query during tests.
import workSource from '../components/registry/work-experience.tsx?raw';
// @ts-expect-error Vite exposes source files through its raw query during tests.
import homeSource from '../app/page.tsx?raw';
// @ts-expect-error Vite exposes source files through its raw query during tests.
import dossierSource from './dossier.ts?raw';

import { ContributionGraph, enhanceContributionGraph } from '@/components/registry/contribution-graph';
import {
  GitHubContributions,
  contributionSnapshotToActivities,
} from '@/components/registry/github-contributions';
import { WorkExperience, groupTimelineExperience } from '@/components/registry/work-experience';
import contributionJson from '@/content/github-contributions.json';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';

vi.mock('server-only', () => ({}));

const profile = profileJson as Profile;

describe('work experience registry adapter', () => {
  it('groups eight raw positions into seven organizations in first-seen order', () => {
    const experience = groupTimelineExperience(profile.timeline);

    expect(experience.map((item) => item.organization)).toEqual([
      'Singtel',
      'CiTaDel Cybersecurity Solutions',
      'Singapore Armed Forces',
      'NCS Pte Ltd',
      'NullSec',
      'Genesis',
      'Homeless Hearts of Singapore',
    ]);
    expect(experience.flatMap((item) => item.positions)).toHaveLength(8);
    expect(experience.map((item) => item.organization)).not.toContain('National University of Singapore');
    expect(experience.map((item) => item.organization)).not.toContain('Ngee Ann Polytechnic');
  });

  it('preserves the Singtel position order and raw timeline copy', () => {
    const experience = groupTimelineExperience(profile.timeline);
    const singtel = experience[0];
    const rawPositions = profile.timeline.filter((entry) => entry.org === 'Singtel');

    expect(singtel.positions.map((position) => position.title)).toEqual([
      'Forward Deployed AI & Automation Security Engineer',
      'Cybersecurity Consultant Intern',
    ]);
    expect(singtel.positions.map((position) => position.period)).toEqual([
      'Aug 2026 to present',
      'May 2026 to Aug 2026',
    ]);
    expect(singtel.positions).toEqual(rawPositions.map((entry) => ({
      id: entry.id,
      period: entry.period,
      summary: entry.summary,
      title: entry.title,
      type: entry.type,
    })));
    expect(experience.flatMap((item) => item.positions)).toEqual(
      profile.timeline.filter((entry) => entry.type !== 'education').map((entry) => ({
        id: entry.id,
        period: entry.period,
        summary: entry.summary,
        title: entry.title,
        type: entry.type,
      })),
    );
  });

  it('composes one CopyDisclosure for every position', () => {
    const markup = renderToStaticMarkup(createElement(WorkExperience, {
      experiences: groupTimelineExperience(profile.timeline),
    }));

    expect(markup).toContain('data-slot="work-experience"');
    expect(markup.match(/data-work-organization="true"/g)).toHaveLength(7);
    expect(markup.match(/data-work-position="true"/g)).toHaveLength(8);
    expect(markup.match(/data-copy-disclosure="timeline"/g)).toHaveLength(8);
    expect(markup.match(/Read more/g)).toHaveLength(8);
    expect(markup.match(/Read less/g)).toHaveLength(8);
  });
});

describe('GitHub contribution registry adapters', () => {
  it('maps the committed snapshot to exactly 365 thresholded activities', () => {
    const activities = contributionSnapshotToActivities(contributionJson);

    expect(activities).toHaveLength(365);
    expect(activities[0]).toEqual({ date: '2025-08-31', count: 0, level: 0 });
    expect(activities.at(-1)).toEqual({ date: '2026-08-30', count: 17, level: 4 });
    expect([0, 1, 2, 3, 4].map((level) => activities.filter((activity) => activity.level === level).length))
      .toEqual([330, 11, 10, 7, 7]);
    expect(contributionSnapshotToActivities({
      ...contributionJson,
      weeks: [{
        contributionDays: [0, 1, 2, 3, 5, 6, 9, 10].map((contributionCount, index) => ({
          contributionCount,
          date: `2026-01-${String(index + 1).padStart(2, '0')}`,
        })),
      }],
    })).toEqual([
      { date: '2026-01-01', count: 0, level: 0 },
      { date: '2026-01-02', count: 1, level: 1 },
      { date: '2026-01-03', count: 2, level: 1 },
      { date: '2026-01-04', count: 3, level: 2 },
      { date: '2026-01-05', count: 5, level: 2 },
      { date: '2026-01-06', count: 6, level: 3 },
      { date: '2026-01-07', count: 9, level: 3 },
      { date: '2026-01-08', count: 10, level: 4 },
    ]);
  });

  it('renders direct activity data as 53 weeks with labels, legend, and one tab stop', () => {
    const activities = contributionSnapshotToActivities(contributionJson);
    const markup = renderToStaticMarkup(createElement(GitHubContributions, {
      contributions: activities,
      totalContributions: contributionJson.total_contributions,
    }));
    const monthLabels = [...markup.matchAll(/data-month-label="true"[^>]*>([^<]+)</g)]
      .map((match) => match[1]);
    const monthAnchorWeeks = [...markup.matchAll(/data-month-label="true"[^>]*x="(\d+)"/g)]
      .map((match) => Number(match[1]) / 12);
    const cellTags = [...markup.matchAll(/<g[^>]*data-contribution-cell="true"[^>]*>/g)]
      .map((match) => match[0]);

    expect(markup).toContain('data-slot="github-contributions"');
    expect(markup).toContain('data-slot="contribution-graph"');
    expect(markup.match(/data-week-column="true"/g)).toHaveLength(53);
    expect(monthLabels).toEqual([
      'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb',
      'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug',
    ]);
    expect(monthAnchorWeeks).toEqual([0, 4, 8, 13, 17, 22, 26, 30, 34, 39, 43, 47]);
    expect(markup.match(/data-legend-level="[0-4]"/g)).toHaveLength(5);
    expect(cellTags).toHaveLength(365);
    expect(cellTags.filter((tag) => tag.includes('tabindex="0"'))).toHaveLength(1);
    expect(cellTags.filter((tag) => tag.includes('tabindex="-1"'))).toHaveLength(364);
    expect(cellTags.every((tag) => tag.includes('role="img"') && tag.includes('aria-label="'))).toBe(true);
    expect(markup.match(/<title>\d{4}-\d{2}-\d{2}: \d+ contributions<\/title>/g)).toHaveLength(365);
    expect(markup).toContain('fill-heat-0');
    expect(markup).toContain('fill-heat-4');
  });

  it('moves the single tab stop to the adjacent cell with arrow keys', () => {
    type Listener = (event: { key?: string; preventDefault?(): void; target: FakeCell }) => void;
    interface FakeCell {
      attributes: Map<string, string>;
      closest(selector: string): FakeCell | null;
      focus(): void;
      getAttribute(name: string): string | null;
      setAttribute(name: string, value: string): void;
    }

    const listeners = new Map<string, Listener>();
    const cells = new Map<string, FakeCell>();
    let focused: FakeCell | undefined;
    const makeCell = (week: number, day: number, tabIndex: string) => {
      const attributes = new Map([
        ['data-contribution-day', String(day)],
        ['data-contribution-week', String(week)],
        ['tabindex', tabIndex],
      ]);
      const cell: FakeCell = {
        attributes,
        closest: (selector) => selector.includes('[data-contribution-cell]') ? cell : null,
        focus: vi.fn(() => { focused = cell; }),
        getAttribute: (name) => attributes.get(name) ?? null,
        setAttribute: (name, value) => { attributes.set(name, value); },
      };
      cells.set(`${week}:${day}`, cell);
      return cell;
    };
    const first = makeCell(0, 0, '0');
    const destination = makeCell(1, 0, '-1');
    const root = {
      addEventListener(type: string, listener: Listener) { listeners.set(type, listener); },
      querySelector(selector: string) {
        if (selector.includes('[tabindex="0"]')) {
          return [...cells.values()].find((cell) => cell.getAttribute('tabindex') === '0') ?? null;
        }
        const week = selector.match(/data-contribution-week="(\d+)"/)?.[1];
        const day = selector.match(/data-contribution-day="(\d+)"/)?.[1];
        return week !== undefined && day !== undefined ? cells.get(`${week}:${day}`) ?? null : null;
      },
    };
    const preventDefault = vi.fn();

    enhanceContributionGraph(root);
    listeners.get('keydown')?.({ key: 'ArrowRight', preventDefault, target: first });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(focused).toBe(destination);
    expect(first.getAttribute('tabindex')).toBe('-1');
    expect(destination.getAttribute('tabindex')).toBe('0');
  });

  it('keeps the graph API direct and synchronous', () => {
    const activities = contributionSnapshotToActivities(contributionJson);
    const markup = renderToStaticMarkup(createElement(ContributionGraph, { data: activities }));

    expect(markup).toContain('data-slot="contribution-graph"');
    expect(activities).not.toBeInstanceOf(Promise);
  });

  it('keeps the static adapter free of remote and optional-package paths', () => {
    expect(githubSource).not.toMatch(/Promise|fetch\(|next\/cache|unstable_cache|Tooltip|Spinner/);
    expect(githubSource).toMatch(/contributions:\s*Activity\[\]/);
    expect(graphSource).not.toContain('date-fns');
    expect(workSource).not.toMatch(/date-fns|react-markdown/);
    expect(homeSource).not.toContain('contribution-heatmap');
    expect(dossierSource).not.toContain('contributionHeatBucket');
  });
});
