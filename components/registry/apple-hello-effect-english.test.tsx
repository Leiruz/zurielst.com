import { Children, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AppleHelloEffectEnglish } from './apple-hello-effect-english';

type StrokeProps = {
  onAnimationEnd?: (event: { animationName: string }) => void;
  pathLength?: number;
  style?: Record<string, string>;
};

describe('AppleHelloEffectEnglish', () => {
  it('preserves scaled handwriting timing and completes after the final stroke', () => {
    const onAnimationComplete = vi.fn();
    const effect = AppleHelloEffectEnglish({
      durationScale: 2,
      onAnimationComplete,
    });
    const [, firstStroke, finalStroke] = Children.toArray(
      effect.props.children,
    ) as ReactElement<StrokeProps>[];

    expect(effect.type).toBe('svg');
    expect(firstStroke.props).toMatchObject({
      pathLength: 1,
      style: {
        '--hello-delay': '0s',
        '--hello-duration': '1.6s',
      },
    });
    expect(finalStroke.props).toMatchObject({
      pathLength: 1,
      style: {
        '--hello-delay': '1.4s',
        '--hello-duration': '5.6s',
      },
    });

    finalStroke.props.onAnimationEnd?.({ animationName: 'unrelated' });
    expect(onAnimationComplete).not.toHaveBeenCalled();

    finalStroke.props.onAnimationEnd?.({ animationName: 'apple-hello-draw' });
    expect(onAnimationComplete).toHaveBeenCalledOnce();
  });
});
