import { AbsoluteFill } from 'remotion';
import { frameStyle, mono, palette, sans } from './design';

export function OgCard() {
  return (
    <AbsoluteFill style={{ ...frameStyle, padding: 62 }}>
      <svg style={{ position: 'absolute', inset: 0 }} width="1200" height="630" viewBox="0 0 1200 630" aria-hidden="true">
        <defs>
          <pattern id="og-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke={palette.ink} strokeOpacity="0.07" />
          </pattern>
        </defs>
        <rect width="1200" height="630" fill="url(#og-grid)" />
        <path d="M62 102V62H102M1098 62H1138V102M1138 528V568H1098M102 568H62V528" fill="none" stroke={palette.ink} strokeOpacity="0.38" strokeWidth="2" />
        <circle cx="986" cy="315" r="202" fill="none" stroke={palette.ink} strokeOpacity="0.12" />
        <circle cx="986" cy="315" r="137" fill="none" stroke={palette.ink} strokeOpacity="0.12" />
        <circle cx="986" cy="315" r="72" fill="none" stroke={palette.accent} strokeOpacity="0.3" />
        <path d="M784 315H1188M986 113V517" stroke={palette.ink} strokeOpacity="0.12" />
        <path d="M986 315L1132 176A202 202 0 0 1 1188 315Z" fill={palette.accent} fillOpacity="0.09" />
        <circle cx="986" cy="315" r="8" fill={palette.accent} />
      </svg>

      <main style={{ alignItems: 'flex-start', display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'space-between', maxWidth: 830, position: 'relative' }}>
        <div style={{ alignItems: 'center', display: 'flex', fontFamily: mono, fontSize: 22, fontWeight: 700, gap: 18, letterSpacing: '0.18em' }}>
          <span style={{ color: palette.accent }}>ZST</span>
          <span style={{ color: palette.muted, fontSize: 15, fontWeight: 500 }}>PUBLIC DOSSIER / 001</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <h1 style={{ fontFamily: sans, fontSize: 76, fontWeight: 680, letterSpacing: '-0.055em', lineHeight: 0.94, margin: 0, maxWidth: 780 }}>
            Zuriel Shanley<br />Tanyory
          </h1>
          <p style={{ color: palette.accent, fontFamily: mono, fontSize: 25, fontWeight: 650, letterSpacing: '0.16em', margin: 0 }}>
            AI. CYBER. DEFENCE.
          </p>
          <div style={{ background: palette.ink, height: 1, opacity: 0.32, width: 560 }} />
          <p style={{ color: palette.muted, fontSize: 25, letterSpacing: '-0.02em', lineHeight: 1.3, margin: 0 }}>
            Using AI to automate &amp; solve security solutions.
          </p>
        </div>

        <div style={{ color: palette.muted, display: 'flex', fontFamily: mono, fontSize: 14, justifyContent: 'space-between', letterSpacing: '0.13em', width: 660 }}>
          <span>SECURITY ENGINEERING</span>
          <span>SINGAPORE / UTC+8</span>
        </div>
      </main>
    </AbsoluteFill>
  );
}
