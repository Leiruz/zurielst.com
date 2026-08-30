import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountUpMetric } from '@/components/dossier/count-up-metric';
import { LiveClock } from '@/components/dossier/live-clock';
import { Reveal } from '@/components/dossier/reveal';

describe('Reveal', () => {
  it('server-renders non-reduced content in its hidden start state', () => {
    const markup = renderToStaticMarkup(createElement(Reveal, null, 'Evidence'));

    expect(markup).toContain('data-reveal-state="hidden"');
  });
});

describe('CountUpMetric', () => {
  it('server-renders an accessible final value beside a hidden zero animation start', () => {
    const markup = renderToStaticMarkup(createElement(CountUpMetric, { value: '99.9%' }));

    expect(markup).toContain('<span class="sr-only">99.9%</span>');
    expect(markup).not.toContain('aria-label="99.9%"');
    expect(markup).toContain('data-count-up-static="true">99.9%');
    expect(markup).toContain('data-count-up-animated="true">0.0%');
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
