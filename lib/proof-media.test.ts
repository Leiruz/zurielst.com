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

function proofTileMarkup(markup: string, title: string): string {
  const encodedTitle = renderToStaticMarkup(createElement('span', null, title))
    .replace(/^<span>|<\/span>$/g, '');
  const titleIndex = markup.indexOf(`>${encodedTitle}</h4>`);
  const tileStart = markup.lastIndexOf('<article', titleIndex);
  const tileEnd = markup.indexOf('</article>', titleIndex);

  expect(titleIndex).toBeGreaterThanOrEqual(0);
  expect(tileStart).toBeGreaterThanOrEqual(0);
  expect(tileEnd).toBeGreaterThan(titleIndex);
  return markup.slice(tileStart, tileEnd + '</article>'.length);
}

describe('ProofWall media', () => {
  it('top-aligns retained accolade images and never renders extras', () => {
    const sourceExtra = sourceProfile.proof_wall.extras[0];
    expect(sourceExtra).toBeDefined();
    if (!sourceExtra) return;
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
    ].filter((item) => item.image).length;

    const markup = renderToStaticMarkup(createElement(ProofWall, { profile }));

    expect(expectedImageCount).toBeGreaterThan(0);
    expect(markup.match(/object-cover object-top/g) ?? []).toHaveLength(expectedImageCount);
    expect(markup).not.toContain(sourceExtra.title);
    expect(markup).not.toContain(`src="${sourceExtra.media}"`);
  });

  it('links matched certification and award images as safe new-tab credentials', () => {
    const credentialItems = [
      ...sourceProfile.proof_wall.certifications,
      ...sourceProfile.proof_wall.awards,
    ].filter((item) => item.image);
    const markup = renderToStaticMarkup(createElement(ProofWall, { profile: sourceProfile }));

    expect(credentialItems.map((item) => [item.id, item.image])).toEqual([
      ['fortinet-fcac', '/media/certs/fortinet-fcac.png'],
      ['fortigate-74-operator', '/media/certs/fortigate-74-operator.png'],
      ['cyberark-trustee', '/media/certs/cyberark-trustee.png'],
      ['cyberark-pam-intro', '/media/certs/cyberark-pam-intro.png'],
      ['carbon-black-fundamentals', '/media/certs/carbon-black-fundamentals.png'],
      ['nus-zero-to-one', '/media/certs/nus-zero-to-one.jpg'],
      ['fearless-find-2026', '/media/certs/big-fearless-find-2026.jpg'],
      ['singtel-scholarship', '/media/certs/singtel-scholarship.jpg'],
      ['mindef-bug-bounty', '/media/certs/mindef-bug-bounty-2019.jpg'],
      ['homeless-hearts-appreciation', '/media/certs/homeless-hearts-appreciation.png'],
      ['cys-eae-hackathon', '/media/certs/cys-eae-hackathon-2020.png'],
    ]);
    expect(credentialItems).toHaveLength(11);
    expect(markup.match(/data-haptic="true"/g) ?? []).toHaveLength(credentialItems.length + 1);
    expect(markup.match(/>View credential ↗<\/a>/g) ?? []).toHaveLength(credentialItems.length + 1);
    for (const item of credentialItems) {
      const tileMarkup = proofTileMarkup(markup, item.title);
      expect(tileMarkup).toContain(`href="${item.image}"`);
      expect(tileMarkup).toContain('target="_blank"');
      expect(tileMarkup).toContain('rel="noopener noreferrer"');
    }

    for (const item of sourceProfile.proof_wall.ctf_results.filter((result) => result.image)) {
      expect(proofTileMarkup(markup, item.title)).not.toContain('View credential');
    }
  });

  it('links Cisco PDF and Fearless image credentials without previewing the PDF', () => {
    const cisco = sourceProfile.proof_wall.certifications.find(
      (item) => item.id === 'cisco-cyber-threat-management',
    );
    const fearless = sourceProfile.proof_wall.awards.find(
      (item) => item.id === 'fearless-find-2026',
    );
    const markup = renderToStaticMarkup(createElement(ProofWall, { profile: sourceProfile }));

    expect(cisco).toBeDefined();
    expect(fearless).toBeDefined();
    if (!cisco || !fearless) return;

    const ciscoTile = proofTileMarkup(markup, cisco.title);
    const fearlessTile = proofTileMarkup(markup, fearless.title);
    expect(ciscoTile).toContain('href="/media/certs/cisco-cyber-threat-management.pdf"');
    expect(ciscoTile).not.toContain('<img');
    expect(ciscoTile).toContain('target="_blank"');
    expect(ciscoTile).toContain('rel="noopener noreferrer"');
    expect(fearlessTile).toContain('href="/media/certs/big-fearless-find-2026.jpg"');
    expect(fearlessTile).toContain('src="/media/certs/big-fearless-find-2026.jpg"');
    expect(fearlessTile).toContain('target="_blank"');
    expect(fearlessTile).toContain('rel="noopener noreferrer"');
  });
});
