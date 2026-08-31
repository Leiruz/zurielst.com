import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { DossierFrame, mono, palette, SignalTrace } from './design';

export function CardLoop() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const phase = (frame / durationInFrames) * Math.PI * 2;
  const squareRotation = (frame / durationInFrames) * 90;
  const signal = interpolate(Math.sin(phase), [-1, 1], [0.35, 1]);
  const scanY = interpolate(Math.cos(phase), [-1, 1], [98, 262]);

  return (
    <DossierFrame>
      <AbsoluteFill style={{ padding: '64px 66px' }}>
        <div style={{ color: palette.muted, display: 'flex', fontFamily: mono, fontSize: 10, justifyContent: 'space-between', letterSpacing: '0.18em' }}>
          <span>FIG. 09 / SIGNAL PROOF</span>
          <span style={{ color: palette.accent }}>VERIFIED</span>
        </div>

        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ alignItems: 'center', display: 'flex', gap: 22 }}>
            <div style={{ border: `1px solid ${palette.accent}`, height: 54, opacity: signal, rotate: `${squareRotation}deg`, width: 54 }} />
            <div>
              <p style={{ fontSize: 35, fontWeight: 650, letterSpacing: '-0.045em', lineHeight: 1, margin: 0 }}>Systems in motion.</p>
              <p style={{ color: palette.muted, fontFamily: mono, fontSize: 11, letterSpacing: '0.13em', margin: '13px 0 0' }}>DETERMINISTIC / AUDITABLE / LIVE</p>
            </div>
          </div>
          <div style={{ marginTop: 24, opacity: signal }}>
            <SignalTrace width={508} height={82} />
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ backgroundColor: palette.accent, height: 1, left: 42, opacity: 0.16, position: 'absolute', right: 42, top: scanY }} />
    </DossierFrame>
  );
}
