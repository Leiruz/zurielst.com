import { describe, expect, it } from 'vitest';

import snapshot from '@/content/analytics-snapshot.json';

describe('committed analytics snapshot', () => {
  it('contains exactly 30 contiguous UTC days in the declared range', () => {
    expect(snapshot.days).toHaveLength(30);
    expect(snapshot.days[0]?.date).toBe(snapshot.range.from);
    expect(snapshot.days.at(-1)?.date).toBe(snapshot.range.to);
    expect(new Date(snapshot.generated_at).toISOString()).toBe(snapshot.generated_at);

    for (const [index, day] of snapshot.days.entries()) {
      const expected = new Date(`${snapshot.range.from}T00:00:00.000Z`);
      expected.setUTCDate(expected.getUTCDate() + index);
      expect(day.date).toBe(expected.toISOString().slice(0, 10));
      expect(Number.isFinite(day.views) && day.views >= 0).toBe(true);
      expect(Number.isFinite(day.visits) && day.visits >= 0).toBe(true);
      expect(typeof day.sampled).toBe('boolean');
    }
  });
});
