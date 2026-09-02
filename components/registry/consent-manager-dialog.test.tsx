// @ts-expect-error The Vitest config supports raw source imports for this pinned dependency contract.
import consentWidgetButtons from '../../node_modules/@c15t/react/dist/components/consent-manager-widget/atoms/button.js?raw';
import { describe, expect, it } from 'vitest';

describe('c15t consent dialog action contract', () => {
  it('retains its reject and save actions for necessary-only choices', () => {
    expect(consentWidgetButtons).toContain('action:"reject-consent"');
    expect(consentWidgetButtons).toContain('action:"custom-consent"');
  });
});
