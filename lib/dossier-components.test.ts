import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountUpMetric } from '@/components/dossier/count-up-metric';
import { LiveClock } from '@/components/dossier/live-clock';
import { ScrollFadeEffect } from '@/components/registry/scroll-fade-effect';
// @ts-expect-error The Vitest config exposes the stylesheet source as a virtual text module.
import styles from 'virtual:globals-css-source';

describe('ScrollFadeEffect', () => {
  it('server-renders the progressive section entrance marker', () => {
    const markup = renderToStaticMarkup(
      createElement(ScrollFadeEffect, { entrance: true, delayIndex: 2 }, 'Evidence'),
    );

    expect(markup).toContain('data-scroll-fade-effect="entrance"');
    expect(markup).toContain('--scroll-fade-range-start:3%');
    expect(markup).toContain('--scroll-fade-range-end:31%');
    expect(markup).toContain('Evidence');
  });

  it('stagger offsets the scroll range without a time delay that can snap', () => {
    const entranceRule = styles.match(/\.scroll-fade-entrance\s*\{([\s\S]*?)^\}/m)?.[1];

    expect(entranceRule).toBeDefined();
    expect(entranceRule).not.toContain('animation-delay');
    expect(styles).toMatch(/animation: scroll-fade-entrance 1s both/);
    expect(styles).toMatch(/animation-range-start: entry var\(--scroll-fade-range-start/);
    expect(styles).toMatch(/animation-range-end: cover var\(--scroll-fade-range-end/);
  });
});

describe('CountUpMetric', () => {
  it('server-renders an accessible final value beside a hidden zero animation start', () => {
    const markup = renderToStaticMarkup(createElement(CountUpMetric, { value: '40+' }));

    expect(markup).toContain('<span class="sr-only">40+</span>');
    expect(markup).not.toContain('aria-label="40+"');
    expect(markup).toContain('data-count-up-static="true">40+');
    expect(markup).toContain('data-count-up-animated="true">0+');
  });
});

describe('LiveClock', () => {
  it('derives its server fallback label from location data', () => {
    const markup = renderToStaticMarkup(createElement(LiveClock, {
      location: { city: 'Test City', timezone: 'UTC-5' },
    }));

    expect(markup).toContain('aria-label="Current time in Test City: --:--:-- -05"');
    expect(markup).toContain('>--:--:-- -05</time>');
    expect(markup).not.toContain('datetime=');
    expect(markup).not.toContain('ahead of you');
    expect(markup).not.toContain('behind you');
  });
});
