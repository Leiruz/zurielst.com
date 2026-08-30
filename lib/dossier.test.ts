import { describe, expect, it } from 'vitest';
import * as dossier from './dossier';
import { contributionHeatBucket, parseMetric } from './dossier';

describe('formatLocationClock', () => {
  it('derives matching visible and machine-readable time from location data', () => {
    const formatter = Reflect.get(dossier, 'formatLocationClock') as unknown;

    expect(formatter).toBeTypeOf('function');
    if (typeof formatter !== 'function') return;

    expect(formatter(new Date('2026-08-30T10:02:03.000Z'), { city: 'Test City', timezone: 'UTC-5' })).toEqual({
      display: '05:02:03 -05',
      dateTime: '2026-08-30T05:02:03-05:00',
      accessibleLabel: 'Current time in Test City: 05:02:03 -05',
    });
  });
});

describe('deriveInitials', () => {
  it('uses the first and last words from a profile name', () => {
    const deriveInitials = Reflect.get(dossier, 'deriveInitials') as unknown;

    expect(deriveInitials).toBeTypeOf('function');
    if (typeof deriveInitials !== 'function') return;

    expect(deriveInitials('Ada Byron Lovelace')).toBe('AL');
  });
});

describe('parseMetric', () => {
  it('parses an integer percentage', () => {
    expect(parseMetric('80%')).toEqual({
      value: 80,
      prefix: '',
      suffix: '%',
      fractionDigits: 0,
    });
  });

  it('preserves text before a numeric percentage', () => {
    expect(parseMetric('Up to 90%')).toEqual({
      value: 90,
      prefix: 'Up to ',
      suffix: '%',
      fractionDigits: 0,
    });
  });

  it('preserves one decimal place', () => {
    expect(parseMetric('99.9%')).toEqual({
      value: 99.9,
      prefix: '',
      suffix: '%',
      fractionDigits: 1,
    });
  });

  it('returns null for a metric without a number', () => {
    expect(parseMetric('WAF telemetry')).toBeNull();
  });
});

describe('contributionHeatBucket', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [9, 3],
    [10, 4],
    [24, 4],
  ])('maps %i contributions to heat bucket %i', (count, expectedBucket) => {
    expect(contributionHeatBucket(count)).toBe(expectedBucket);
  });
});

describe('formatVisitorRelativeOffset', () => {
  it.each([
    [-360, '2h ahead of you'],
    [-600, '2h behind you'],
    [-480, 'same time as you'],
    [-330, '2h 30m ahead of you'],
  ])('formats a visitor offset of %i minutes', (visitorOffsetMinutes, expected) => {
    const formatter = Reflect.get(dossier, 'formatVisitorRelativeOffset') as unknown;

    expect(formatter).toBeTypeOf('function');
    if (typeof formatter !== 'function') return;

    expect(formatter('UTC+8', visitorOffsetMinutes)).toBe(expected);
  });
});

describe('greetingForHour', () => {
  it.each([
    [0, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [17, 'Good afternoon'],
    [18, 'Good evening'],
    [23, 'Good evening'],
  ])('maps local hour %i to %s', (hour, expectedGreeting) => {
    const greetingForHour = Reflect.get(dossier, 'greetingForHour') as unknown;
    expect(greetingForHour).toBeTypeOf('function');
    if (typeof greetingForHour !== 'function') return;

    expect(greetingForHour(hour)).toBe(expectedGreeting);
  });
});

describe('splitDisclosureCopy', () => {
  type CopySplit = { teaser: string; remainder: string };
  type CopySplitter = (text: string, approximateLimit: number) => CopySplit;

  const getSplitter = () => {
    const splitter = Reflect.get(dossier, 'splitDisclosureCopy') as unknown;
    expect(splitter).toBeTypeOf('function');
    return typeof splitter === 'function' ? splitter as CopySplitter : undefined;
  };

  it('leaves copy within the preferred limit intact', () => {
    const splitter = getSplitter();
    if (!splitter) return;

    expect(splitter('Short copy stays visible.', 160)).toEqual({
      teaser: 'Short copy stays visible.',
      remainder: '',
    });
  });

  it('uses the last complete sentence within the preferred limit', () => {
    const splitter = getSplitter();
    if (!splitter) return;
    const text = 'First sentence. Second sentence also fits. Third sentence becomes the remainder.';

    expect(splitter(text, 45)).toEqual({
      teaser: 'First sentence. Second sentence also fits.',
      remainder: 'Third sentence becomes the remainder.',
    });
  });

  it('falls forward to the first sentence boundary instead of cutting a word', () => {
    const splitter = getSplitter();
    if (!splitter) return;
    const text = 'This deliberately long opening sentence crosses the preferred threshold before reaching its natural ending. The rest stays hidden.';
    const result = splitter(text, 55);

    expect(result.teaser).toBe('This deliberately long opening sentence crosses the preferred threshold before reaching its natural ending.');
    expect(result.remainder).toBe('The rest stays hidden.');
    expect(`${result.teaser} ${result.remainder}`).toBe(text);
    expect(result.teaser).toMatch(/[.!?]$/);
    expect(result.remainder).toMatch(/^\S/);
  });

  it('keeps the teaser to at most two complete sentences', () => {
    const splitter = getSplitter();
    if (!splitter) return;
    const text = 'One short sentence. Two stays concise. Three would also fit. A final sentence pushes the copy beyond the preferred limit.';

    expect(splitter(text, 70)).toEqual({
      teaser: 'One short sentence. Two stays concise.',
      remainder: 'Three would also fit. A final sentence pushes the copy beyond the preferred limit.',
    });
  });
});
