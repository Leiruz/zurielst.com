import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import * as roleRotatorModule from '@/components/dossier/role-rotator';
// @ts-expect-error The Vitest config exposes the stylesheet source as a virtual text module.
import styles from 'virtual:globals-css-source';

describe('RoleRotator', () => {
  it('keeps the three-second rotation cadence', () => {
    expect(Reflect.get(roleRotatorModule, 'ROLE_ROTATION_INTERVAL_MS')).toBe(3_000);
  });

  it('server-renders every role in a CSS-timed light-up track without announcements', () => {
    const markup = renderToStaticMarkup(
      createElement(roleRotatorModule.RoleRotator, {
        roles: ['Security Engineer', 'Founder'],
      }),
    );

    expect(markup).toContain('aria-live="off"');
    expect(markup).toContain('<span class="sr-only">Security Engineer</span>');
    expect(markup).not.toContain('aria-label="Security Engineer"');
    expect(markup).toContain('role-rotator-track');
    expect(markup).toContain('--role-count:2');
    expect(markup).toContain('role-light-up');
    expect(markup).toContain('Security Engineer');
    expect(markup).toContain('Founder');
  });

  it('does not render an empty rotation track', () => {
    const markup = renderToStaticMarkup(
      createElement(roleRotatorModule.RoleRotator, { roles: [] }),
    );

    expect(markup).toBe('');
  });

  it('runs a neutral two-second left-to-right sweep before a readable rest', () => {
    const roleLightUpRule = styles.match(/\.role-light-up\s*\{([\s\S]*?)^\}/m)?.[1];

    expect(styles).toMatch(/@keyframes role-light-up-sweep\s*\{[\s\S]*0%\s*\{ background-position: 100% 50%; \}[\s\S]*66\.6+%, 100%\s*\{ background-position: 0 50%; \}/);
    expect(styles).toMatch(/\.role-light-up\s*\{[\s\S]*animation: role-light-up-sweep 3s/);
    expect(roleLightUpRule).toBeDefined();
    expect(roleLightUpRule).not.toContain('var(--ring)');
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.role-light-up[\s\S]*animation: none !important/);
  });
});
