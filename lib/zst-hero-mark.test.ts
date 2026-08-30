import { describe, expect, it } from 'vitest';

import { ZstHeroMark } from '@/components/dossier/zst-hero-mark';

describe('ZstHeroMark', () => {
  it('uses a native anchor without a client-side click handler', () => {
    const mark = ZstHeroMark();

    expect(mark.props.href).toBe('#identity');
    expect(mark.props['aria-label']).toBe('Return to top');
    expect(mark.props.onClick).toBeUndefined();
  });

  it('keeps every transformed letter stroke inside an expanded blueprint canvas', () => {
    const mark = ZstHeroMark();
    const svg = mark.props.children;

    expect(svg.props.viewBox).toBe('0 0 330 280');
    expect(svg.props.children.at(-2).props.d).toBe('M18 264H312');
  });
});
