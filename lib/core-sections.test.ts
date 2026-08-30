import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { SelectedWork } from '@/components/sections/selected-work';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';
import * as dossier from '@/lib/dossier';

vi.mock('server-only', () => ({}));

const profile = profileJson as Profile;

function expectRenderedText(markup: string, value: string) {
  const encodedValue = renderToStaticMarkup(createElement('span', null, value)).replace(/^<span>|<\/span>$/g, '');
  expect(markup).toContain(encodedValue);
}

describe('core dossier sections', () => {
  it('server-renders the four section contracts and 53 contribution weeks', () => {
    const markup = renderToStaticMarkup(createElement(Home));

    for (const [id, label] of [
      ['contributions', 'Fig. 2. Contributions'],
      ['capabilities', 'Fig. 3. Capabilities'],
      ['work', 'Fig. 4. Selected work'],
      ['timeline', 'Fig. 5. Timeline'],
    ] as const) {
      expect(markup).toContain(`id="${id}"`);
      expect(markup).toContain(label);
    }

    expect(markup.match(/data-week-column="true"/g)).toHaveLength(53);
    expect(markup).toContain('role="region"');

    const nameParts = profile.identity.name.trim().split(/\s+/);
    const initials = `${nameParts[0]?.[0] ?? ''}${nameParts.at(-1)?.[0] ?? ''}`.toUpperCase();
    expect(markup).toContain(`<span role="img" aria-label="${profile.identity.name} monogram">${initials}</span>`);
  });

  it('server-renders copy disclosures collapsed with their full text available', () => {
    const splitter = Reflect.get(dossier, 'splitDisclosureCopy') as unknown;
    expect(splitter).toBeTypeOf('function');
    if (typeof splitter !== 'function') return;
    const markup = renderToStaticMarkup(createElement(Home));

    expect(markup).toContain('id="copy-disclosure-state"');
    expect(markup).toContain('setAttribute("aria-expanded"');

    const capabilitySplits = profile.capabilities.acts.map((act) => ({
      act,
      split: splitter(act.narrative, 160) as { teaser: string; remainder: string },
    }));
    const collapsedCapabilities = capabilitySplits.filter(({ split }) => split.remainder !== '');
    expect(markup.match(/data-copy-disclosure="capability"/g)).toHaveLength(collapsedCapabilities.length);
    const longWorkCases = profile.work_cases.filter((workCase) => workCase.summary.length > 200);
    expect(longWorkCases).toHaveLength(3);
    expect(markup.match(/data-copy-disclosure="work"/g)).toHaveLength(longWorkCases.length);
    expect(markup.match(/data-copy-disclosure="timeline"/g)).toHaveLength(profile.timeline.length);
    const disclosureBlocks = markup.match(/<details(?=[^>]*data-copy-disclosure)[\s\S]*?<\/details>/g) ?? [];
    expect(disclosureBlocks).toHaveLength(
      collapsedCapabilities.length + longWorkCases.length + profile.timeline.length,
    );
    for (const block of disclosureBlocks) {
      const openingTag = block.match(/^<details[^>]*>/)?.[0] ?? '';
      expect(openingTag).not.toMatch(/\sopen(?:=|\s|>)/);
      expect(block).toMatch(/^<details[^>]*><summary[^>]*aria-expanded="false"/);
      expect(block).toContain('Read more');
    }

    for (const { act, split: { teaser, remainder } } of capabilitySplits) {
      expect(remainder).not.toBe('');
      expect(`${teaser} ${remainder}`).toBe(act.narrative);
      expect(markup).toContain(`data-copy-id="${act.id}"`);
      expectRenderedText(markup, teaser);
      expectRenderedText(markup, remainder);
      const disclosureStart = markup.indexOf(`data-copy-id="${act.id}"`);
      const disclosureEnd = markup.indexOf('</details>', disclosureStart);
      const skillGrid = markup.indexOf(`data-skill-grid="${act.id}"`, disclosureEnd);
      expect(disclosureStart).toBeGreaterThanOrEqual(0);
      expect(disclosureEnd).toBeGreaterThan(disclosureStart);
      expect(skillGrid).toBeGreaterThan(disclosureEnd);
    }

    for (const workCase of profile.work_cases) {
      const { teaser, remainder } = splitter(workCase.summary, 200) as { teaser: string; remainder: string };
      if (workCase.summary.length > 200) {
        expect(remainder).not.toBe('');
        expect(`${teaser} ${remainder}`).toBe(workCase.summary);
        expect(markup).toContain(`data-copy-id="${workCase.id}"`);
        expectRenderedText(markup, teaser);
        expectRenderedText(markup, remainder);
      } else {
        expect(remainder).toBe('');
        expectRenderedText(markup, workCase.summary);
        expect(markup).not.toContain(`data-copy-id="${workCase.id}"`);
      }
    }

    for (const entry of profile.timeline) {
      const disclosureStart = markup.indexOf(`data-copy-id="${entry.id}"`);
      const disclosureEnd = markup.indexOf('</details>', disclosureStart);
      expect(disclosureStart).toBeGreaterThanOrEqual(0);
      expect(disclosureEnd).toBeGreaterThan(disclosureStart);
      expectRenderedText(markup.slice(disclosureStart, disclosureEnd), entry.summary);
    }
  });

  it('keeps a long single-sentence work summary visible without an empty disclosure', () => {
    const longSingleSentence = `${'A deliberately unbroken sentence stays readable without a false disclosure control '.repeat(4).trim()}.`;
    expect(longSingleSentence.length).toBeGreaterThan(200);
    const workCaseId = profile.work_cases[0].id;
    const edgeCaseProfile = {
      ...profile,
      work_cases: profile.work_cases.map((workCase, index) => (
        index === 0 ? { ...workCase, summary: longSingleSentence } : workCase
      )),
    } as Profile;
    const markup = renderToStaticMarkup(createElement(SelectedWork, { profile: edgeCaseProfile }));

    expect(markup).not.toContain(`data-copy-id="${workCaseId}"`);
    expectRenderedText(markup, longSingleSentence);
  });
});
