import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { DossierFrame, mono, palette, Radar, SignalTrace } from './design';
import { getLoopProgress } from './timing';

export function HeroLoop() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = getLoopProgress(frame, durationInFrames);
  const phase = progress * Math.PI * 2;
  const scanX = interpolate(Math.sin(phase), [-1, 1], [96, 544]);

  return (
    <DossierFrame>
      <AbsoluteFill style={{ alignItems: 'center', display: 'flex', justifyContent: 'center' }}>
        <div style={{ opacity: 0.94, position: 'relative' }}>
          <Radar size={258} />
          <span style={{ color: palette.muted, fontFamily: mono, fontSize: 10, left: -75, letterSpacing: '0.16em', position: 'absolute', top: 122 }}>
            AMBIENT SCAN / 30FPS
          </span>
        </div>
      </AbsoluteFill>
      <div style={{ left: 64, opacity: 0.62, position: 'absolute', right: 64, top: 50 }}>
        <SignalTrace width={512} height={56} />
      </div>
      <div style={{ backgroundColor: palette.accent, height: 260, left: scanX, opacity: 0.12, position: 'absolute', top: 50, width: 1 }} />
      <div style={{ bottom: 38, color: palette.muted, display: 'flex', fontFamily: mono, fontSize: 9, justifyContent: 'space-between', left: 42, letterSpacing: '0.16em', position: 'absolute', right: 42 }}>
        <span>ZST / BLUEPRINT FIELD</span>
        <span>SG 01 17 N / 103 51 E</span>
      </div>
    </DossierFrame>
  );
}
