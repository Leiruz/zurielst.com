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
