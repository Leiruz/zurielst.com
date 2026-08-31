import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { SelectedWork } from '@/components/sections/selected-work';
import { Timeline } from '@/components/sections/timeline';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';
import * as dossier from '@/lib/dossier';

vi.mock('server-only', () => ({}));

const profile = profileJson as Profile;

const expectedSectionIds = [
  'identity', 'intro', 'contributions', 'insights', 'capabilities', 'stack', 'work',
  'timeline', 'education', 'proof', 'products', 'brands', 'faq', 'contact',
];

const expectedFigureLabels = [
  'Identity', 'Introduction', 'Contributions', 'Insights', 'Capabilities', 'Stack',
  'Selected work', 'Timeline', 'Education', 'Accolades', 'Products',
  'Worked with', 'FAQ', 'Contact',
];

function expectRenderedText(markup: string, value: string) {
  const encodedValue = renderToStaticMarkup(createElement('span', null, value)).replace(/^<span>|<\/span>$/g, '');
  expect(markup).toContain(encodedValue);
}

describe('core dossier sections', () => {
  it('server-renders the core section contracts and 53 contribution weeks', () => {
    const markup = renderToStaticMarkup(createElement(Home));

    for (const [index, id] of expectedSectionIds.entries()) {
      expect(markup).toContain(`id="${id}"`);
      expect(markup).toContain(`Fig. ${index + 1}. ${expectedFigureLabels[index]}`);
    }

    expect(markup.match(/data-week-column="true"/g)).toHaveLength(53);
    expect(markup.match(/data-contribution-cell="true"/g)).toHaveLength(365);
    expect(markup).toContain('data-slot="github-contributions"');
    expect(markup).toContain('data-slot="contribution-graph"');
    expect(markup).toContain('role="region"');

    expect(markup).toContain(`src="${profile.identity.portrait.image}"`);
    expect(markup).toContain(`alt="${profile.identity.portrait.alt}"`);
    expect(markup).toContain(
      `<span hidden="" role="img" aria-label="${profile.identity.name} monogram">ZT</span>`,
    );
  });

  it('merges Fig. 5 into act 01 without changing the Capabilities navigation name', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const start = markup.indexOf('<section id="capabilities"');
    const end = markup.indexOf('<section id="stack"', start);
    const capabilitiesMarkup = markup.slice(start, end);

    expect(capabilitiesMarkup).toContain('data-capability-header="security"');
    expect(capabilitiesMarkup).toMatch(/data-capability-header="security"[\s\S]*>01<\/p>[\s\S]*id="capabilities-title"[\s\S]*Security/);
    expect(capabilitiesMarkup).toContain('Fig. 5. Capabilities');
    expect(capabilitiesMarkup).toContain('href="#capabilities"');
    expect(capabilitiesMarkup).not.toContain('>Capabilities</h2>');
  });

  it('renders Introduction, Stack, and Brands from profile data in page order', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const identityStart = markup.indexOf('id="identity"');
    const introStart = markup.indexOf('id="intro"');
    const contributionsStart = markup.indexOf('id="contributions"');
    const insightsStart = markup.indexOf('id="insights"');
    const capabilitiesStart = markup.indexOf('id="capabilities"');
    const stackStart = markup.indexOf('id="stack"');
    const workStart = markup.indexOf('id="work"');
    const productsStart = markup.indexOf('id="products"');
    const brandsStart = markup.indexOf('id="brands"');
    const faqStart = markup.indexOf('id="faq"');
    const navMarkup = markup.slice(markup.indexOf('<nav'), markup.indexOf('</nav>') + '</nav>'.length);
    const introMarkup = markup.slice(introStart, contributionsStart);
    const stackMarkup = markup.slice(stackStart, workStart);
    const brandsMarkup = markup.slice(brandsStart, faqStart);
    const stackItems = profile.stack.categories.flatMap((category) => category.items);

    expect(identityStart).toBeGreaterThanOrEqual(0);
    expect(introStart).toBeGreaterThan(identityStart);
    expect(contributionsStart).toBeGreaterThan(introStart);
    expect(insightsStart).toBeGreaterThan(contributionsStart);
    expect(capabilitiesStart).toBeGreaterThan(insightsStart);
    expect(stackStart).toBeGreaterThan(capabilitiesStart);
    expect(workStart).toBeGreaterThan(stackStart);
    expect(productsStart).toBeGreaterThan(workStart);
    expect(brandsStart).toBeGreaterThan(productsStart);
    expect(faqStart).toBeGreaterThan(brandsStart);

    expect(introMarkup).toContain('data-local-greeting="true">Hello</');
    expect(introMarkup.match(/data-intro-bullet="true"/g)).toHaveLength(profile.intro.bullets.length);
    for (const bullet of profile.intro.bullets) expectRenderedText(introMarkup, bullet);

    expect(stackMarkup.match(/data-stack-category="true"/g)).toHaveLength(profile.stack.categories.length);
    expect(stackMarkup.match(/data-stack-item="true"/g)).toHaveLength(stackItems.length);
    for (const [index, category] of profile.stack.categories.entries()) {
      expectRenderedText(stackMarkup, String(index + 1).padStart(2, '0'));
      expectRenderedText(stackMarkup, category.name);
      for (const item of category.items) expectRenderedText(stackMarkup, item);
    }
    expect(stackMarkup).not.toMatch(/<(?:img|svg)\b/);

    expect(brandsMarkup.match(/data-brand-tile="true"/g)).toHaveLength(profile.stack_brands.brands.length);
    for (const brand of profile.stack_brands.brands) {
      expectRenderedText(brandsMarkup, brand.name);
      expectRenderedText(brandsMarkup, brand.context);
    }
    expectRenderedText(brandsMarkup, profile.stack_brands.disclaimer);
    expect(brandsMarkup).not.toMatch(/<img\b/);
    expect(brandsMarkup).not.toMatch(/<svg\b/);
    expect(brandsMarkup).not.toContain('M5 12h14');
    expect(brandsMarkup).not.toContain('M12 5v14');

    expect(markup).toContain('href="#stack"');
    expect(markup).toContain('>Stack</a>');
    expect(navMarkup).not.toContain('href="#intro"');
    expect(navMarkup).not.toContain('href="#brands"');
    expect(markup).toContain('href="#proof"');
    expect(markup).toContain('>Accolades</a>');
    expect(markup).not.toContain('>Proof</a>');
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
    const nonEducationEntries = profile.timeline.filter((entry) => entry.type !== 'education');
    expect(markup.match(/data-work-organization="true"/g)).toHaveLength(7);
    expect(markup.match(/data-work-position="true"/g)).toHaveLength(8);
    expect(markup.match(/data-copy-disclosure="timeline"/g)).toHaveLength(nonEducationEntries.length);
    const disclosureBlocks = markup.match(/<details(?=[^>]*data-copy-disclosure)[\s\S]*?<\/details>/g) ?? [];
    expect(disclosureBlocks).toHaveLength(
      collapsedCapabilities.length + longWorkCases.length + nonEducationEntries.length,
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

    for (const entry of nonEducationEntries) {
      const disclosureStart = markup.indexOf(`data-copy-id="${entry.id}"`);
      const disclosureEnd = markup.indexOf('</details>', disclosureStart);
      expect(disclosureStart).toBeGreaterThanOrEqual(0);
      expect(disclosureEnd).toBeGreaterThan(disclosureStart);
      expectRenderedText(markup.slice(disclosureStart, disclosureEnd), entry.summary);
    }
  });

  it('keeps education out of Timeline and renders it in its own reverse-chronological section', () => {
    const timelineMarkup = renderToStaticMarkup(createElement(Timeline, { profile }));
    const homeMarkup = renderToStaticMarkup(createElement(Home));
    const educationStart = homeMarkup.indexOf('id="education"');
    const proofStart = homeMarkup.indexOf('id="proof"');
    const educationMarkup = homeMarkup.slice(educationStart, proofStart);
    const educationEntries = profile.timeline
      .filter((entry) => entry.type === 'education')
      .sort((left, right) => Number.parseInt(right.period.match(/\d{4}/)?.[0] ?? '0', 10)
        - Number.parseInt(left.period.match(/\d{4}/)?.[0] ?? '0', 10));

    expect(educationStart).toBeGreaterThanOrEqual(0);
    expect(proofStart).toBeGreaterThan(educationStart);
    expect(educationEntries.map((entry) => entry.org)).toEqual([
      'National University of Singapore',
      'Ngee Ann Polytechnic',
    ]);

    for (const entry of educationEntries) {
      expect(timelineMarkup).not.toContain(entry.org);
      expectRenderedText(educationMarkup, entry.org);
      expectRenderedText(educationMarkup, entry.title);
      expectRenderedText(educationMarkup, entry.period);
      expectRenderedText(educationMarkup, entry.summary);
    }

    for (const entry of profile.timeline.filter((entry) => entry.type !== 'education')) {
      expect(educationMarkup).not.toContain(entry.title);
      expect(timelineMarkup).toContain(entry.org);
    }

    expect(educationMarkup.indexOf(educationEntries[0].org))
      .toBeLessThan(educationMarkup.indexOf(educationEntries[1].org));
  });

  it('orders Timeline, Education, and Accolades and links Education from the site navigation', () => {
    const markup = renderToStaticMarkup(createElement(Home));
    const timelineStart = markup.indexOf('id="timeline"');
    const educationStart = markup.indexOf('id="education"');
    const proofStart = markup.indexOf('id="proof"');

    expect(timelineStart).toBeGreaterThanOrEqual(0);
    expect(educationStart).toBeGreaterThan(timelineStart);
    expect(proofStart).toBeGreaterThan(educationStart);
    expect(markup).toContain('href="#education"');
    expect(markup).toContain('>Education</a>');
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
