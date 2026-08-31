import { describe, expect, it, vi } from 'vitest';

import {
  listenForPageEngagement,
  scheduleAfterPaint,
  shouldMountConsent,
  watchIntroCompletion,
} from './client-enhancements';

function frameHarness() {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  const cancelled: number[] = [];

  return {
    request(callback: FrameRequestCallback) {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    },
    cancel(id: number) {
      cancelled.push(id);
      callbacks.delete(id);
    },
    run(id: number) {
      const callback = callbacks.get(id);
      callbacks.delete(id);
      callback?.(0);
    },
    callbacks,
    cancelled,
  };
}

describe('scheduleAfterPaint', () => {
  it('runs the callback only after two animation frames', () => {
    const frames = frameHarness();
    let completed = false;

    scheduleAfterPaint(
      () => {
        completed = true;
      },
      frames.request,
      frames.cancel,
    );

    expect(completed).toBe(false);
    frames.run(1);
    expect(completed).toBe(false);
    frames.run(2);
    expect(completed).toBe(true);
  });

  it('cancels a pending nested frame during cleanup', () => {
    const frames = frameHarness();
    const cleanup = scheduleAfterPaint(
      () => {},
      frames.request,
      frames.cancel,
    );

    frames.run(1);
    cleanup();

    expect(frames.cancelled).toEqual([2]);
    expect(frames.callbacks.size).toBe(0);
  });
});

describe('consent enhancement gating', () => {
  it('mounts consent only after paint, intro completion, and page engagement', () => {
    expect(
      shouldMountConsent({
        engaged: true,
        introComplete: true,
        ready: true,
      }),
    ).toBe(true);

    for (const missing of ['engaged', 'introComplete', 'ready'] as const) {
      expect(
        shouldMountConsent({
          engaged: missing !== 'engaged',
          introComplete: missing !== 'introComplete',
          ready: missing !== 'ready',
        }),
      ).toBe(false);
    }
  });

  it('reports the first page engagement and removes every listener', () => {
    const listeners = new Map<string, EventListener>();
    const removed: string[] = [];
    const target = {
      addEventListener(
        name: string,
        listener: EventListener,
        _options?: AddEventListenerOptions,
      ) {
        listeners.set(name, listener);
      },
      removeEventListener(
        name: string,
        _listener: EventListener,
        _options?: EventListenerOptions,
      ) {
        removed.push(name);
        listeners.delete(name);
      },
    };
    const onEngage = vi.fn();

    const cleanup = listenForPageEngagement(onEngage, target);

    expect([...listeners.keys()]).toEqual([
      'pointerdown',
      'keydown',
      'wheel',
      'touchstart',
    ]);
    listeners.get('keydown')?.({ type: 'keydown' } as Event);
    expect(onEngage).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
    expect(removed).toEqual([
      'pointerdown',
      'keydown',
      'wheel',
      'touchstart',
    ]);

    cleanup();
    expect(onEngage).toHaveBeenCalledOnce();
  });

  it('waits for the intro completion attribute and disconnects once', () => {
    const root = { dataset: { intro: 'active' } };
    const onComplete = vi.fn();
    const disconnect = vi.fn();
    let notify = () => {};
    const observe = vi.fn();

    const cleanup = watchIntroCompletion(onComplete, root, (callback) => {
      notify = callback;
      return { disconnect, observe };
    });

    expect(observe).toHaveBeenCalledWith(root, {
      attributeFilter: ['data-intro'],
      attributes: true,
    });
    notify();
    expect(onComplete).not.toHaveBeenCalled();

    root.dataset.intro = 'done';
    notify();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();

    cleanup();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it('completes immediately without creating an observer when intro is done', () => {
    const onComplete = vi.fn();
    const createObserver = vi.fn();

    const cleanup = watchIntroCompletion(
      onComplete,
      { dataset: { intro: 'done' } },
      createObserver,
    );

    expect(onComplete).toHaveBeenCalledOnce();
    expect(createObserver).not.toHaveBeenCalled();
    cleanup();
  });
});
