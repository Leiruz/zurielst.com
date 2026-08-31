import { createElement, Fragment } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error The Vitest config exposes the stylesheet source as a virtual text module.
import styles from 'virtual:globals-css-source';

import {
  getIntroLeavingDelay,
  hasSeenIntro,
  IntroOverlay,
} from './intro-gate';
import * as introGateModule from './intro-gate';
import {
  advanceSlideKeyboardProgress,
  attemptSlideUnlock,
  SlideToUnlock,
  SlideToUnlockHandle,
  SlideToUnlockTrack,
} from './slide-to-unlock';
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

function countSlideToEnterLabels(markup: string) {
  return markup.match(/>slide to enter<\/span>/g)?.length ?? 0;
}

function createIntroOverlay(
  overrides: Partial<Parameters<typeof IntroOverlay>[0]> = {},
) {
  return IntroOverlay({
    animationComplete: true,
    leaving: false,
    onAnimationComplete: () => {},
    onDismiss: () => {},
    reducedMotion: false,
    ...overrides,
  });
}

describe('hasSeenIntro', () => {
  it('checks writable storage without marking an unseen intro complete', () => {
    const values = new Map<string, string>();
    const storage = {
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

    expect(hasSeenIntro(storage)).toBe(false);
    expect(values.get('zst-hello-seen')).toBeUndefined();
  });

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

  it('stamps a throwing storage read done', () => {
    const root = { dataset: {} as Record<string, string | undefined> };
    const schedule = vi.fn();
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem() {},
      removeItem() {},
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

  it('keeps an unseen reduced-motion session pending for explicit entry', () => {
    const root = { dataset: {} as Record<string, string | undefined> };
    const schedule = vi.fn();

    stampInitialIntro({
      root,
      storage: createWritableStorage(),
      matchMedia: () => ({ matches: true }),
      schedule,
    });

    expect(root.dataset.intro).toBe('pending');
    expect(schedule).toHaveBeenCalledOnce();
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
    expect(markup).not.toContain('>slide to enter</span>');
    expect(markup).not.toContain('>skip</span>');
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

describe('intro animation fallback', () => {
  it('reveals the entry control after the full-motion animation window if the event is lost', () => {
    type InstallFallback = (
      state: {
        animationComplete: boolean;
        reducedMotion: boolean;
        show: boolean;
      },
      onAnimationComplete: () => void,
      runtime: {
        clearTimeout(timer: number): void;
        setTimeout(callback: () => void, delay: number): number;
      },
    ) => () => void;
    const installFallback = Reflect.get(
      introGateModule,
      'installIntroAnimationFallback',
    ) as InstallFallback | undefined;
    const onAnimationComplete = vi.fn();
    let scheduledCallback: (() => void) | undefined;
    const clearTimeout = vi.fn();
    const setTimeout = vi.fn((callback: () => void, delay: number) => {
      scheduledCallback = callback;
      expect(delay).toBeGreaterThanOrEqual(3_500);
      return 41;
    });

    expect(installFallback).toBeTypeOf('function');
    if (!installFallback) return;

    const cleanup = installFallback(
      { animationComplete: false, reducedMotion: false, show: true },
      onAnimationComplete,
      { clearTimeout, setTimeout },
    );

    expect(setTimeout).toHaveBeenCalledOnce();
    expect(onAnimationComplete).not.toHaveBeenCalled();
    scheduledCallback?.();
    expect(onAnimationComplete).toHaveBeenCalledOnce();
    cleanup();
    expect(clearTimeout).toHaveBeenCalledWith(41);

    for (const state of [
      { animationComplete: true, reducedMotion: false, show: true },
      { animationComplete: false, reducedMotion: true, show: true },
      { animationComplete: false, reducedMotion: false, show: false },
    ]) {
      setTimeout.mockClear();
      installFallback(state, onAnimationComplete, { clearTimeout, setTimeout });
      expect(setTimeout).not.toHaveBeenCalled();
    }
  });
});

describe('IntroOverlay', () => {
  it('uses the shared capped hello size for the hydrated SVG', () => {
    const overlay = createIntroOverlay();
    const [animation] = overlay.props.children;

    expect(animation.props.className).toContain(INTRO_HELLO_SIZE_CLASS);
  });

  it('uses explicit white styling independent of the page theme', () => {
    const overlay = createIntroOverlay();
    const [animation, slideControl] = overlay.props.children;

    expect(animation.props.className).toContain('text-white');
    expect(slideControl.props.className).toContain('text-white');
  });

  it('exposes its controls while hiding the decorative animation', () => {
    const overlay = createIntroOverlay();
    const [animation] = overlay.props.children;
    const markup = renderToStaticMarkup(overlay);

    expect(overlay.type).toBe('div');
    expect(overlay.props.role).toBe('dialog');
    expect(overlay.props['aria-modal']).toBe('true');
    expect(overlay.props['aria-label']).toBe('Intro animation');
    expect(overlay.props['aria-hidden']).toBeUndefined();
    expect(animation.props['aria-hidden']).toBe('true');
    expect(markup).toContain('data-slot="slide-to-unlock"');
    expect(markup).toContain('slide to enter');
    expect(markup).not.toContain('Skip intro');
  });

  it('moves initial focus to the slide control', () => {
    const overlay = createIntroOverlay();
    const markup = renderToStaticMarkup(overlay);

    expect(markup).toContain('autofocus=""');
  });

  it('renders a plain instant Enter control for reduced motion', () => {
    const onDismiss = vi.fn();
    const overlay = createIntroOverlay({
      animationComplete: false,
      onAnimationComplete: vi.fn(),
      onDismiss,
      reducedMotion: true,
    });
    const [, enterButton] = overlay.props.children;
    const markup = renderToStaticMarkup(overlay);

    expect(enterButton.type).toBe('button');
    expect(enterButton.props.children).toBe('Enter');
    expect(enterButton.props['data-haptic']).toBe(true);
    enterButton.props.onClick();
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(markup).not.toContain('data-slot="slide-to-unlock"');
    expect(markup).not.toContain('intro-entry-control');
    expect(getIntroLeavingDelay(true)).toBe(0);
    expect(getIntroLeavingDelay(false)).toBe(500);
  });

  it('waits for the full handwriting animation before fading in one slide label', () => {
    const onAnimationComplete = vi.fn();
    const pendingProps = {
      animationComplete: false,
      onAnimationComplete,
      onDismiss: vi.fn(),
    };
    const pendingOverlay = createIntroOverlay(pendingProps);
    const [animation] = pendingOverlay.props.children;
    const pendingMarkup = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(IntroCover),
        pendingOverlay,
      ),
    );

    expect(pendingMarkup).not.toContain('data-slot="slide-to-unlock"');
    expect(countSlideToEnterLabels(pendingMarkup)).toBe(0);
    expect(animation.props.onAnimationComplete).toBe(onAnimationComplete);

    const completedProps = { ...pendingProps, animationComplete: true };
    const completedMarkup = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(IntroCover),
        createIntroOverlay(completedProps),
      ),
    );

    expect(completedMarkup).toContain('intro-entry-control');
    expect(countSlideToEnterLabels(completedMarkup)).toBe(1);
    expect(styles).toMatch(
      /@keyframes intro-entry-fade-in\s*\{[\s\S]*from\s*\{[\s\S]*opacity:\s*0;[\s\S]*to\s*\{[\s\S]*opacity:\s*1;/,
    );
  });

  it.each([
    ['forward', false],
    ['reverse', true],
  ])(
    'keeps %s Tab focus on the entry control while visible',
    (_direction, shiftKey) => {
      const overlay = createIntroOverlay();
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

  it('focuses and traps the pending dialog until the entry control mounts', () => {
    const overlay = createIntroOverlay({ animationComplete: false });
    const handler = overlay.props.onKeyDown;
    const focus = vi.fn();
    const preventDefault = vi.fn();

    expect(overlay.props.tabIndex).toBe(-1);
    expect(overlay.props.autoFocus).toBeUndefined();
    expect(overlay.props.ref).toBeTypeOf('function');
    overlay.props.ref({ focus });
    expect(focus).toHaveBeenCalledOnce();

    focus.mockClear();
    expect(handler).toBeTypeOf('function');
    if (typeof handler !== 'function') return;

    handler({
      key: 'Tab',
      preventDefault,
      currentTarget: {
        focus,
        querySelector: vi.fn(),
      },
    });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });

  it('reports handwriting completion only for full-motion sessions', () => {
    const onAnimationComplete = vi.fn();
    const fullMotion = createIntroOverlay({
      animationComplete: false,
      onAnimationComplete,
      onDismiss: vi.fn(),
    });
    const reducedMotion = createIntroOverlay({
      animationComplete: false,
      onAnimationComplete,
      onDismiss: vi.fn(),
      reducedMotion: true,
    });
    const [fullAnimation] = fullMotion.props.children;
    const [reducedAnimation] = reducedMotion.props.children;

    expect(fullAnimation.props.onAnimationComplete).toBe(onAnimationComplete);
    expect(reducedAnimation.props.onAnimationComplete).toBeUndefined();
  });

  it('does not trap Tab after the leaving transition begins', () => {
    const overlay = createIntroOverlay({
      leaving: true,
    });
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

describe('SlideToUnlockHandle', () => {
  it('renders a real haptic button', () => {
    const markup = renderToStaticMarkup(
      createElement(
        SlideToUnlock,
        { onUnlock: vi.fn() },
        createElement(
          SlideToUnlockTrack,
          null,
          createElement(SlideToUnlockHandle),
        ),
      ),
    );

    expect(markup).toContain('<button');
    expect(markup).toContain('data-slot="handle"');
    expect(markup).toContain('data-haptic="true"');
  });

  it.each(['Enter', ' '])('unlocks from the %s key', (key) => {
    const onUnlock = vi.fn();
    const state = { current: false };

    expect(attemptSlideUnlock(state, onUnlock, false, key)).toBe(true);

    expect(onUnlock).toHaveBeenCalledOnce();
  });

  it('reaches completion by holding ArrowRight', () => {
    let progress = 0;

    for (let press = 0; press < 10; press += 1) {
      progress = advanceSlideKeyboardProgress(progress, 'ArrowRight');
    }

    expect(progress).toBe(1);
  });

  it('does not unlock twice or while disabled', () => {
    const onUnlock = vi.fn();
    const state = { current: false };

    expect(attemptSlideUnlock(state, onUnlock, true, 'Enter')).toBe(false);
    expect(attemptSlideUnlock(state, onUnlock, false, 'Enter')).toBe(true);
    expect(attemptSlideUnlock(state, onUnlock, false, 'Enter')).toBe(false);
    expect(onUnlock).toHaveBeenCalledOnce();
  });
});
