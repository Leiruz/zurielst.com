import { createElement, Fragment } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { hasSeenIntro, IntroOverlay } from './intro-gate';
import {
  INTRO_HELLO_SIZE_CLASS,
  IntroCover,
  IntroFirstPaintHead,
  stampInitialIntro,
} from './intro-first-paint';

function createWritableStorage(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

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

  it('treats a silently ignored storage write as already seen', () => {
    expect(
      hasSeenIntro({
        getItem() {
          return null;
        },
        setItem() {},
      }),
    ).toBe(true);
  });
});

describe('first-paint intro state', () => {
  it('stamps seen sessions done without scheduling a fallback', () => {
    const root = { dataset: {} as Record<string, string | undefined> };
    const schedule = vi.fn();

    stampInitialIntro({
      root,
      storage: createWritableStorage({ 'zst-hello-seen': '1' }),
      matchMedia: () => ({ matches: false }),
      schedule,
    });

    expect(root.dataset.intro).toBe('done');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('stamps unseen sessions pending and releases an unclaimed cover after eight seconds', () => {
    const root = { dataset: {} as Record<string, string | undefined> };
    let fallback: (() => void) | undefined;

    stampInitialIntro({
      root,
      storage: createWritableStorage(),
      matchMedia: () => ({ matches: false }),
      schedule(callback, delay) {
        expect(delay).toBe(8_000);
        fallback = callback;
      },
    });

    expect(root.dataset.intro).toBe('pending');
    expect(fallback).toBeTypeOf('function');
    fallback?.();
    expect(root.dataset.intro).toBe('done');
  });

  it('stamps throwing storage writes done without scheduling a fallback', () => {
    const root = { dataset: {} as Record<string, string | undefined> };
    const schedule = vi.fn();
    const storage = {
      getItem: () => null,
      setItem() {
        throw new Error('storage unavailable');
      },
      removeItem: vi.fn(),
    };

    stampInitialIntro({
      root,
      storage,
      matchMedia: () => ({ matches: false }),
      schedule,
    });

    expect(root.dataset.intro).toBe('done');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('stamps ignored storage writes done without scheduling a fallback', () => {
    const root = { dataset: {} as Record<string, string | undefined> };
    const schedule = vi.fn();
    const storage = {
      getItem: () => null,
      setItem() {},
      removeItem: vi.fn(),
    };

    stampInitialIntro({
      root,
      storage,
      matchMedia: () => ({ matches: false }),
      schedule,
    });

    expect(root.dataset.intro).toBe('done');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('does not mistake a stale probe value for a successful write', () => {
    const root = { dataset: {} as Record<string, string | undefined> };
    const schedule = vi.fn();
    const storage = {
      getItem(key: string) {
        return key === 'zst-intro-storage-probe' ? '1' : null;
      },
      setItem() {},
      removeItem: vi.fn(),
    };

    stampInitialIntro({
      root,
      storage,
      matchMedia: () => ({ matches: false }),
      schedule,
    });

    expect(root.dataset.intro).toBe('done');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('does not release a cover claimed by the hydrated app', () => {
    const root = { dataset: {} as Record<string, string | undefined> };
    let fallback: (() => void) | undefined;

    stampInitialIntro({
      root,
      storage: createWritableStorage(),
      matchMedia: () => ({ matches: false }),
      schedule(callback) {
        fallback = callback;
      },
    });

    root.dataset.intro = 'active';
    fallback?.();
    expect(root.dataset.intro).toBe('active');
  });

  it.each([
    [
      'a throwing storage read',
      {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem() {},
        removeItem() {},
      },
      () => ({ matches: false }),
    ],
    [
      'reduced motion',
      createWritableStorage(),
      () => ({ matches: true }),
    ],
  ])('stamps %s done', (_case, storage, matchMedia) => {
    const root = { dataset: {} as Record<string, string | undefined> };
    const schedule = vi.fn();

    stampInitialIntro({ root, storage, matchMedia, schedule });

    expect(root.dataset.intro).toBe('done');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('server-renders the black cover, synchronous stamp, and no-script escape hatch', () => {
    const markup = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(IntroFirstPaintHead),
        createElement(IntroCover),
      ),
    );

    expect(markup).toContain('id="intro-state-stamp"');
    expect(markup).toContain('zst-hello-seen');
    expect(markup).toContain('prefers-reduced-motion: reduce');
    expect(markup).toContain('id="intro-cover"');
    expect(markup).toContain('class="intro-cover"');
    expect(markup).toContain('data-intro-static-hello="true"');
    expect(markup).toContain('<svg');
    expect(markup).toContain('>skip</span>');
    expect(markup).toContain('<noscript>');
    expect(markup).toContain('#intro-cover{display:none!important}');
  });

  it('uses the shared capped hello size for the first-paint SVG', () => {
    const markup = renderToStaticMarkup(createElement(IntroCover));

    expect(INTRO_HELLO_SIZE_CLASS).toBe(
      'h-auto w-[clamp(200px,32vw,420px)]',
    );
    expect(markup).toContain(INTRO_HELLO_SIZE_CLASS);
  });
});

describe('IntroOverlay', () => {
  it('uses the shared capped hello size for the hydrated SVG', () => {
    const overlay = IntroOverlay({ leaving: false, onDismiss: () => {} });
    const [animation] = overlay.props.children;

    expect(animation.props.className).toContain(INTRO_HELLO_SIZE_CLASS);
  });

  it('uses explicit white styling independent of the page theme', () => {
    const overlay = IntroOverlay({ leaving: false, onDismiss: () => {} });
    const [animation, skipButton] = overlay.props.children;

    expect(animation.props.className).toContain('text-white');
    expect(skipButton.props.className).toContain('text-white');
  });

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
