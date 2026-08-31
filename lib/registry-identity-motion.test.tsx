import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

// @ts-expect-error Vite virtual module has no type declaration.
import styles from 'virtual:globals-css-source';

import * as fluidGradientModule from '@/components/registry/fluid-gradient-text';
import { ShimmeringText } from '@/components/registry/shimmering-text';
import { TextFlip } from '@/components/registry/text-flip';
import { SiteNav } from '@/components/site-nav';

const FluidGradientText = fluidGradientModule.FluidGradientText;

describe('registry identity and motion adapters', () => {
  it('renders the accessible shimmering Zuriel Shanley terminal wordmark', () => {
    const markup = renderToStaticMarkup(createElement(SiteNav));

    expect(markup).toContain('aria-label="Zuriel Shanley"');
    expect(markup).toContain('data-slot="shimmering-text"');
    expect(markup).toContain('>Zuriel Shanley</span>');
    expect(markup).not.toContain('data-slot="spotlight-logo"');
    expect(markup).not.toMatch(/>ZST</);
    expect(markup).not.toContain('chanhdai');
  });

  it('retains no spotlight-logo implementation in source', () => {
    const registryModules = Object.keys(
      import.meta.glob('/components/registry/*.tsx'),
    );

    expect(registryModules.some((m) => m.includes('spotlight-logo'))).toBe(false);
    expect(styles).not.toContain('spotlight-logo');
  });

  it('keeps text effects accessible in server markup', () => {
    const shimmer = renderToStaticMarkup(createElement(ShimmeringText, null, 'Tagline'));
    const flip = renderToStaticMarkup(createElement(TextFlip, { words: ['First', 'Second'] }));
    const gradient = renderToStaticMarkup(createElement(FluidGradientText, null, 'Zuriel'));

    expect(shimmer).toContain('data-slot="shimmering-text"');
    expect(flip).toContain('data-slot="text-flip"');
    expect(flip).toContain('aria-live="off"');
    expect(flip).toContain('First');
    expect(gradient).toContain('data-slot="fluid-gradient-text"');
    expect(gradient).toContain('aria-label="Zuriel"');
  });

  it('maps pointer movement into the fluid gradient and fixes it under reduced motion', () => {
    const resolvePosition = Reflect.get(fluidGradientModule, 'resolveFluidGradientPosition');

    expect(resolvePosition).toBeTypeOf('function');
    expect(resolvePosition(75, { left: 25, width: 100 }, false)).toBe(0.5);
    expect(resolvePosition(200, { left: 25, width: 100 }, false)).toBe(1);
    expect(resolvePosition(75, { left: 25, width: 100 }, true)).toBe(0.5);

    const markup = renderToStaticMarkup(createElement(FluidGradientText, { text: 'Zuriel' }));
    expect(markup).toContain('data-gradient-motion="pointer"');
  });
});
