import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { getLoopProgress } from './timing';

export const palette = {
  accent: '#4b7bff',
  canvas: '#09090a',
  ink: '#f7f8f8',
  muted: '#8a8f98',
  surface: '#0c0d10',
} as const;

export const sans = 'Geist, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const mono = '"Geist Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';

export const frameStyle: CSSProperties = {
  backgroundColor: palette.canvas,
  color: palette.ink,
  fontFamily: sans,
};

export function BlueprintGrid({ opacity = 0.42 }: { opacity?: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = getLoopProgress(frame, durationInFrames);
  const cycle = progress * 160;

  return (
    <AbsoluteFill
      style={{
        backgroundImage: [
          'linear-gradient(rgba(247, 248, 248, 0.08) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(247, 248, 248, 0.08) 1px, transparent 1px)',
          'linear-gradient(rgba(75, 123, 255, 0.08) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(75, 123, 255, 0.08) 1px, transparent 1px)',
        ].join(','),
        backgroundPosition: `${cycle}px ${cycle}px, ${cycle}px ${cycle}px, ${cycle}px ${cycle}px, ${cycle}px ${cycle}px`,
        backgroundSize: '40px 40px, 40px 40px, 160px 160px, 160px 160px',
        opacity,
      }}
    />
  );
}

export function CornerMarks() {
  return (
    <AbsoluteFill aria-hidden="true">
      <svg width="100%" height="100%" viewBox="0 0 640 360" preserveAspectRatio="none">
        <path d="M24 50V24H50M590 24H616V50M616 310V336H590M50 336H24V310" fill="none" stroke={palette.ink} strokeOpacity="0.34" />
      </svg>
    </AbsoluteFill>
  );
}

export function DossierFrame({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill style={frameStyle}>
      <BlueprintGrid />
      <CornerMarks />
      {children}
    </AbsoluteFill>
  );
}

export function Radar({ size, strokeWidth = 1.5 }: { size: number; strokeWidth?: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = getLoopProgress(frame, durationInFrames);
  const angle = progress * 360 - 90;
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={center} cy={center} r={center - 3} fill="none" stroke={palette.ink} strokeOpacity="0.18" strokeWidth={strokeWidth} />
      <circle cx={center} cy={center} r={center * 0.67} fill="none" stroke={palette.ink} strokeOpacity="0.12" strokeWidth={strokeWidth} />
      <circle cx={center} cy={center} r={center * 0.34} fill="none" stroke={palette.accent} strokeOpacity="0.28" strokeWidth={strokeWidth} />
      <path d={`M${center} 4V${size - 4}M4 ${center}H${size - 4}`} stroke={palette.ink} strokeOpacity="0.11" strokeWidth={strokeWidth} />
      <g style={{ transformOrigin: `${center}px ${center}px`, rotate: `${angle}deg` }}>
        <path d={`M${center} ${center} L${size - 3} ${center}`} stroke={palette.accent} strokeWidth={strokeWidth * 1.7} />
        <path d={`M${center} ${center} L${size - 8} ${center - center * 0.38} A${center - 8} ${center - 8} 0 0 1 ${size - 8} ${center + center * 0.38} Z`} fill={palette.accent} fillOpacity="0.08" />
      </g>
      <circle cx={center} cy={center} r={4} fill={palette.accent} />
    </svg>
  );
}

export function SignalTrace({ height, width }: { height: number; width: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = getLoopProgress(frame, durationInFrames);
  const phase = progress * Math.PI * 2;
  const points = Array.from({ length: 65 }, (_, index) => {
    const x = (index / 64) * width;
    const envelope = Math.exp(-Math.pow((index - 38) / 13, 2));
    const y = height / 2 + Math.sin(index * 0.7 + phase) * height * 0.06 + Math.sin(index * 1.9 + phase * 2) * height * 0.24 * envelope;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={palette.ink} strokeOpacity="0.13" />
      <polyline points={points} fill="none" stroke={palette.accent} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
