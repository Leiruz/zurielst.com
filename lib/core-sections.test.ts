import { createElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';

vi.mock('server-only', () => ({}));

describe('core dossier sections', () => {
  it('server-renders the four section contracts and 53 contribution weeks', () => {
    const markup = renderToStaticMarkup(createElement(Home));

    for (const [id, label] of [
      ['contributions', 'Fig. 2. Contributions'],
      ['capabilities', 'Fig. 3. Capabilities'],
      ['work', 'Fig. 4. Selected work'],
      ['timeline', 'Fig. 5. Timeline'],
    ] as const) {
      expect(markup).toContain(`id="${id}"`);
      expect(markup).toContain(label);
    }

    expect(markup.match(/data-week-column="true"/g)).toHaveLength(53);
  });
});
