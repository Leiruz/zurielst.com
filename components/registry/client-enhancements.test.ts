import { describe, expect, it } from 'vitest';

import { scheduleAfterPaint } from './client-enhancements';

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
