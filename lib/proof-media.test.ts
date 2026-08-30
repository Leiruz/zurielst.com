import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProofWall } from '@/components/sections/proof-wall';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/media', () => ({ hasPublicMedia: (mediaPath: string | undefined) => Boolean(mediaPath) }));

const sourceProfile = profileJson as Profile;

describe('ProofWall media', () => {
  it('top-aligns every available proof image', () => {
    const sourceExtra = sourceProfile.proof_wall.extras[0];
    const profile: Profile = {
      ...sourceProfile,
      proof_wall: {
        ...sourceProfile.proof_wall,
        extras: sourceExtra
          ? [{ ...sourceExtra, type: 'image' }]
          : [],
      },
    };
    const expectedImageCount = [
      ...profile.proof_wall.certifications,
      ...profile.proof_wall.awards,
      ...profile.proof_wall.ctf_results,
    ].filter((item) => item.image).length + profile.proof_wall.extras.filter((item) => item.type === 'image').length;

    const markup = renderToStaticMarkup(createElement(ProofWall, { profile }));

    expect(expectedImageCount).toBeGreaterThan(0);
    expect(markup.match(/object-cover object-top/g) ?? []).toHaveLength(expectedImageCount);
  });
});
