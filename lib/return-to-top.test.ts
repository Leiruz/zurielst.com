import { describe, expect, it, vi } from 'vitest';

import { installReturnToTop } from './return-to-top';

function setup(reducedMotion = false) {
  let scrollY = 0;
  let scrollListener: () => void = () => undefined;
  let clickListener: () => void = () => undefined;
  const scrollTo = vi.fn();
  const control = {
    dataset: {} as Record<string, string>,
    blur: vi.fn(),
    setAttribute: vi.fn(),
    tabIndex: 0,
    addEventListener: vi.fn((type: string, listener: () => void) => {
      if (type === 'click') clickListener = listener;
    }),
  };
  const runtime = {
    get scrollY() {
      return scrollY;
    },
    innerHeight: 900,
    addEventListener: vi.fn((type: string, listener: () => void) => {
      if (type === 'scroll') scrollListener = listener;
    }),
    scrollTo,
    matchMedia: vi.fn(() => ({ matches: reducedMotion })),
  };

  installReturnToTop(control, runtime);

  return {
    control,
    runtime,
    scrollTo,
    scrollListener: () => scrollListener(),
    click: () => clickListener(),
    setScrollY: (value: number) => {
      scrollY = value;
    },
  };
}

describe('installReturnToTop', () => {
  it('does nothing when the server-rendered control is absent', () => {
    const runtime = {
      scrollY: 0,
      innerHeight: 900,
      addEventListener: vi.fn(),
      scrollTo: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
    };

    expect(() => installReturnToTop(null, runtime)).not.toThrow();
    expect(runtime.addEventListener).not.toHaveBeenCalled();
    expect(runtime.matchMedia).not.toHaveBeenCalled();
    expect(runtime.scrollTo).not.toHaveBeenCalled();
  });

  it('shows only after scrolling strictly beyond one viewport', () => {
    const { control, runtime, scrollListener, setScrollY } = setup();

    expect(runtime.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
    expect(control.dataset.visible).toBe('false');
    expect(control.setAttribute).toHaveBeenLastCalledWith('aria-hidden', 'true');
    expect(control.tabIndex).toBe(-1);

    setScrollY(runtime.innerHeight);
    scrollListener();
    expect(control.dataset.visible).toBe('false');

    setScrollY(runtime.innerHeight + 1);
    scrollListener();
    expect(control.dataset.visible).toBe('true');
    expect(control.setAttribute).toHaveBeenLastCalledWith('aria-hidden', 'false');
    expect(control.tabIndex).toBe(0);
  });

  it('releases focus before hiding after manual upward scrolling', () => {
    const { control, runtime, scrollListener, setScrollY } = setup();

    expect(control.blur).not.toHaveBeenCalled();

    setScrollY(runtime.innerHeight + 1);
    scrollListener();
    expect(control.dataset.visible).toBe('true');

    control.setAttribute.mockClear();
    setScrollY(runtime.innerHeight);
    scrollListener();

    expect(control.blur).toHaveBeenCalledOnce();
    expect(control.blur.mock.invocationCallOrder[0]).toBeLessThan(
      control.setAttribute.mock.invocationCallOrder[0],
    );
    expect(control.dataset.visible).toBe('false');
    expect(control.setAttribute).toHaveBeenLastCalledWith('aria-hidden', 'true');
    expect(control.tabIndex).toBe(-1);

    scrollListener();
    expect(control.blur).toHaveBeenCalledOnce();
  });

  it('smooth-scrolls to the top when motion is allowed', () => {
    const { click, scrollTo } = setup();

    click();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('auto-scrolls to the top when reduced motion is requested', () => {
    const { click, scrollTo } = setup(true);

    click();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
});
