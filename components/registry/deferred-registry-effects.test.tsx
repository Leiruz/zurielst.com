import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dynamicHarness = vi.hoisted(() => ({ renders: 0 }));

vi.mock('next/dynamic', () => ({
  default: () => function TestFluidGradient({ text }: { text: string }) {
    dynamicHarness.renders += 1;
    return createElement('svg', {
      'aria-label': text,
      'data-slot': 'fluid-gradient-text',
    });
  },
}));

import { DeferredFooterIdentityEffect } from './deferred-registry-effects';

describe('deferred footer identity effect', () => {
  let renderer: ReactTestRenderer | undefined;
  let intersectionCallback: IntersectionObserverCallback | undefined;
  let observe: ReturnType<typeof vi.fn>;
  let disconnect: ReturnType<typeof vi.fn>;
  let observerOptions: IntersectionObserverInit | undefined;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dynamicHarness.renders = 0;
    observe = vi.fn();
    disconnect = vi.fn();
    intersectionCallback = undefined;
    observerOptions = undefined;
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('IntersectionObserver', class TestIntersectionObserver {
      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        intersectionCallback = callback;
        observerOptions = options;
      }

      observe = observe;
      disconnect = disconnect;
      root = null;
      rootMargin = '256px 0px';
      thresholds = [0];
      takeRecords = () => [];
      unobserve = vi.fn();
    });
    const originalConsoleError = console.error;
    consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      if (args[0] === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer') {
        return;
      }
      originalConsoleError(...args);
    });
  });

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    consoleError.mockRestore();
    vi.unstubAllGlobals();
  });

  it('keeps the static wordmark until the footer approaches the viewport', async () => {
    const target = {};
    let mountedRenderer!: ReactTestRenderer;

    await act(async () => {
      mountedRenderer = create(createElement(DeferredFooterIdentityEffect), {
        createNodeMock: (element) => {
          const props = element.props as Record<string, unknown>;
          return props['data-footer-identity-effect'] === 'true' ? target : null;
        },
      });
      renderer = mountedRenderer;
    });

    expect(observe).toHaveBeenCalledWith(target);
    expect(observerOptions).toEqual({ rootMargin: '256px 0px' });
    expect(dynamicHarness.renders).toBe(0);
    expect(mountedRenderer.root.findAllByType('span')).toHaveLength(1);
    expect(mountedRenderer.root.findByType('span').children).toEqual(['Zuriel']);

    await act(async () => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(dynamicHarness.renders).toBe(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(mountedRenderer.root.findAllByProps({ 'data-slot': 'fluid-gradient-text' })).toHaveLength(1);
  });
});
