import { describe, expect, it } from 'vitest';

import { hasSeenIntro, IntroOverlay } from './intro-gate';

describe('hasSeenIntro', () => {
  it('treats a throwing storage read as already seen', () => {
    expect(
      hasSeenIntro({
        getItem() {
          throw new Error('storage unavailable');
        },
        setItem() {},
      }),
    ).toBe(true);
  });

  it('treats a throwing storage write as already seen', () => {
    expect(
      hasSeenIntro({
        getItem() {
          return null;
        },
        setItem() {
          throw new Error('storage unavailable');
        },
      }),
    ).toBe(true);
  });
});

describe('IntroOverlay', () => {
  it('exposes its controls while hiding the decorative animation', () => {
    const overlay = IntroOverlay({ leaving: false, onDismiss: () => {} });
    const [animation, skipButton] = overlay.props.children;

    expect(overlay.type).toBe('div');
    expect(overlay.props.role).toBe('dialog');
    expect(overlay.props['aria-modal']).toBe('true');
    expect(overlay.props['aria-label']).toBe('Intro animation');
    expect(overlay.props['aria-hidden']).toBeUndefined();
    expect(animation.props['aria-hidden']).toBe('true');
    expect(skipButton.props['aria-label']).toBe('Skip intro');
    expect(skipButton.props.children).toBe('skip');
  });

  it('moves initial focus to the Skip control', () => {
    const overlay = IntroOverlay({ leaving: false, onDismiss: () => {} });
    const [, skipButton] = overlay.props.children;

    expect(skipButton.props.autoFocus).toBe(true);
  });

  it.each([
    ['forward', false],
    ['reverse', true],
  ])(
    'keeps %s Tab focus on Skip while visible',
    (_direction, shiftKey) => {
      const overlay = IntroOverlay({ leaving: false, onDismiss: () => {} });
      const handler = overlay.props.onKeyDown;
      let prevented = false;
      let focused = false;

      expect(handler).toBeTypeOf('function');
      if (typeof handler !== 'function') return;

      handler({
        key: 'Tab',
        shiftKey,
        preventDefault() {
          prevented = true;
        },
        currentTarget: {
          querySelector() {
            return {
              focus() {
                focused = true;
              },
            };
          },
        },
      });

      expect(prevented).toBe(true);
      expect(focused).toBe(true);
    },
  );

  it('does not trap Tab after the leaving transition begins', () => {
    const overlay = IntroOverlay({ leaving: true, onDismiss: () => {} });
    const handler = overlay.props.onKeyDown;
    let prevented = false;

    expect(handler).toBeTypeOf('function');
    if (typeof handler !== 'function') return;

    handler({
      key: 'Tab',
      preventDefault() {
        prevented = true;
      },
    });

    expect(prevented).toBe(false);
  });
});
