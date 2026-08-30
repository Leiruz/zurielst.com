import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import * as roleRotatorModule from '@/components/dossier/role-rotator';

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
});
