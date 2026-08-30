import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('node:fs', () => ({
  statSync: (path: string) => ({ isFile: () => path.endsWith('.txt') }),
}));

import { hasPublicMedia } from './media';

describe('hasPublicMedia', () => {
  it('accepts an existing file', () => {
    expect(hasPublicMedia('/media/__media-helper-file__.txt')).toBe(true);
  });

  it('rejects an existing directory', () => {
    expect(hasPublicMedia('/media/__media-helper-directory__')).toBe(false);
  });
});
