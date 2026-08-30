type ThemeChoice = 'light' | 'dark';

const DURATION_SECONDS = 0.11;
const FREQUENCIES = {
  dark: [420, 310],
  light: [520, 660],
} as const;

export function scheduleThemeToggleSound(
  context: AudioContext,
  theme: ThemeChoice,
) {
  try {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const [firstFrequency, secondFrequency] = FREQUENCIES[theme];

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(firstFrequency, now);
    oscillator.frequency.setValueAtTime(
      secondFrequency,
      now + DURATION_SECONDS * 0.5,
    );
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.04, now + 0.008);
    envelope.gain.linearRampToValueAtTime(0, now + DURATION_SECONDS);
    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + DURATION_SECONDS);
  } catch {
    // Audio feedback is optional when WebAudio node construction is blocked.
  }
}
