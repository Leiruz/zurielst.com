import { describe, expect, it, vi } from 'vitest';

import { installHapticFeedback } from './haptic-feedback';

interface FakeTarget {
  closest(selector: string): FakeTarget | null;
}

function rootStub() {
  let clickListener: ((event: { target: FakeTarget | null }) => void) | undefined;
  return {
    root: {
      addEventListener(
        type: 'click',
        listener: (event: { target: FakeTarget | null }) => void,
      ) {
        expect(type).toBe('click');
        clickListener = listener;
      },
      removeEventListener: vi.fn(),
    },
    click(target: FakeTarget | null) {
      clickListener?.({ target });
    },
  };
}

describe('installHapticFeedback', () => {
  it('fires once for a data-haptic target', () => {
    const setup = rootStub();
    const vibrate = vi.fn();
    installHapticFeedback(setup.root, vibrate);

    setup.click({ closest: () => ({ closest: () => null }) });

    expect(vibrate).toHaveBeenCalledOnce();
  });

  it('ignores clicks outside data-haptic controls', () => {
    const setup = rootStub();
    const vibrate = vi.fn();
    installHapticFeedback(setup.root, vibrate);

    setup.click({ closest: () => null });

    expect(vibrate).not.toHaveBeenCalled();
  });

  it('uses closest so nested click targets fire once', () => {
    const setup = rootStub();
    const vibrate = vi.fn();
    const control = { closest: () => null };
    const nested = {
      closest(selector: string) {
        expect(selector).toBe('[data-haptic]');
        return control;
      },
    };
    installHapticFeedback(setup.root, vibrate);

    setup.click(nested);

    expect(vibrate).toHaveBeenCalledOnce();
  });
});
