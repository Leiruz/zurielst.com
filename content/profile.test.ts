import { describe, expect, it } from 'vitest';
import { ProfileSchema } from './schema';
import profile from './profile.json';
import contributions from './github-contributions.json';

describe('content/profile.json', () => {
  it('parses against the strict schema (shape + forbidden-content walk)', () => {
    const result = ProfileSchema.safeParse(profile);
    if (!result.success) {
      throw new Error(JSON.stringify(result.error.issues, null, 2));
    }
  });

  it('raw JSON text carries no phone shapes, gmail, gift subdomains, or em dashes', () => {
    const raw = JSON.stringify(profile);
    expect(raw).not.toMatch(/(\+?65[ -]?)?[89]\d{3}[ -]?\d{4}/);
    expect(raw.toLowerCase()).not.toContain('@gmail.com');
    expect(raw.toLowerCase()).not.toContain('christine.zurielst');
    expect(raw.toLowerCase()).not.toContain('janice.zurielst');
    expect(raw).not.toContain('\u2014');
  });

  it('identifies the site as an Open Graph profile', () => {
    expect(profile.meta.og.type).toBe('profile');
  });

  it('uses the committed root Open Graph image', () => {
    expect(profile.meta.og.image).toBe('/og.png');
  });

  it('uses the owner-approved AI and security identity framing', () => {
    expect(profile.identity.tagline).toBe('Using AI to automate & solve security solutions.');
    expect(profile.identity.metrics).toEqual([
      { value: '40+', label: 'deep learning models trained for security and vision tasks' },
      { value: '200+', label: 'firewalls fed by one automated IOC pipeline' },
      { value: 'Up to 90%', label: 'threat detection uplift from AI-assisted SOC workflows' },
      { value: '100%', label: "of this site's assistant grounded in published profile data" },
    ]);
  });

  it('Singtel content stays at resume level: no internal tool names beyond the resume', () => {
    const raw = JSON.stringify(profile);
    // The resume-level allowlist is what the resume itself says; a couple of
    // known-internal strings must never appear.
    for (const forbidden of ['SCANNER_AI_TIERS', 'llmserver', 'wrangler.jsonc']) {
      expect(raw).not.toContain(forbidden);
    }
  });
});

describe('content/github-contributions.json (derived display data)', () => {
  it('has the committed-snapshot shape the heatmap renders from', () => {
    expect(contributions.source).toContain('github.com/Leiruz');
    expect(contributions.total_contributions).toBeGreaterThan(0);
    expect(Array.isArray(contributions.weeks)).toBe(true);
    expect(contributions.weeks.length).toBeGreaterThanOrEqual(52);
    const day = contributions.weeks[0].contributionDays[0];
    expect(typeof day.date).toBe('string');
    expect(typeof day.contributionCount).toBe('number');
  });
});
