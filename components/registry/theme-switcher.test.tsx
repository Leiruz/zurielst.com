import { createElement, type ComponentType } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { scheduleThemeToggleSound } from '@/lib/theme-toggle-sound';
import { ThemeIconSprite } from '@/components/theme-icon-sprite';
// @ts-expect-error The Vitest config exposes the stylesheet source as a virtual text module.
import styles from 'virtual:globals-css-source';

import * as themeSwitcherModule from './theme-switcher';

type ThemeChoice = 'light' | 'dark';

interface ThemeSwitcherControlProps {
  activeTheme?: ThemeChoice;
  onSelect(theme: ThemeChoice): void;
}

interface ThemeSelectionDependencies {
  currentTheme: string | undefined;
  playSound(theme: ThemeChoice): void;
  prefersReducedMotion(): boolean;
  setTheme(theme: ThemeChoice): void;
}

interface AutomationEvent {
  method: 'linearRampToValueAtTime' | 'setValueAtTime';
  time: number;
  value: number;
}

function audioParamStub() {
  const events: AutomationEvent[] = [];
  return {
    events,
    linearRampToValueAtTime(value: number, time: number) {
      events.push({ method: 'linearRampToValueAtTime', time, value });
      return this;
    },
    setValueAtTime(value: number, time: number) {
      events.push({ method: 'setValueAtTime', time, value });
      return this;
    },
  };
}

function audioContextStub(currentTime = 4) {
  const frequency = audioParamStub();
  const gain = audioParamStub();
  const oscillator = {
    connect: vi.fn(),
    frequency,
    start: vi.fn(),
    stop: vi.fn(),
    type: 'sine',
  };
  const gainNode = {
    connect: vi.fn(),
    gain,
  };
  const context = {
    createGain: vi.fn(() => gainNode),
    createOscillator: vi.fn(() => oscillator),
    currentTime,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    state: 'running',
  };

  return { context, frequency, gain, gainNode, oscillator };
}

function requiredExport<T>(name: string): T | undefined {
  const value = Reflect.get(themeSwitcherModule, name) as T | undefined;
  expect(value, `theme-switcher must export ${name}`).toBeTypeOf('function');
  return value;
}

describe('ThemeSwitcherControl', () => {
  it('renders only 44px light and dark buttons with the pressed state', () => {
    const Control = requiredExport<ComponentType<ThemeSwitcherControlProps>>(
      'ThemeSwitcherControl',
    );
    if (!Control) return;

    const markup = renderToStaticMarkup(
      createElement(Control, { activeTheme: 'dark', onSelect: vi.fn() }),
    );
    const buttons: string[] = markup.match(/<button[\s\S]*?<\/button>/g) ?? [];
    const lightButton = buttons.find((button) => button.includes('Switch to light theme'));
    const darkButton = buttons.find((button) => button.includes('Switch to dark theme'));

    expect(markup).toContain('role="group"');
    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.includes('theme-switcher-button'))).toBe(true);
    expect(styles).toMatch(/\.theme-switcher-button\s*\{[\s\S]*width: 2\.75rem;[\s\S]*height: 2\.75rem;/);
    expect(lightButton).toContain('aria-pressed="false"');
    expect(darkButton).toContain('aria-pressed="true"');
    expect(markup.match(/<svg\b/g)).toHaveLength(2);
    expect(lightButton).toContain('<use href="#theme-light"');
    expect(darkButton).toContain('<use href="#theme-dark"');
    expect(markup.match(/<svg aria-hidden="true"/g)).toHaveLength(2);
    expect(markup).not.toMatch(/>L<|>D</);
    expect(markup).not.toContain('role="radio"');
    expect(markup).not.toContain('Switch to system theme');
  });

  it('defines hand-drawn sun and moon geometry in the inline document sprite', () => {
    const markup = renderToStaticMarkup(createElement(ThemeIconSprite));

    expect(markup).toContain('id="theme-light"');
    expect(markup).toContain('m0-6v2');
    expect(markup).toContain('id="theme-dark"');
    expect(markup).toContain('A9 9 0 1 1');
  });

  it('maps an untouched system preference to the resolved active button', () => {
    const resolveActiveTheme = requiredExport<(
      theme: string | undefined,
      resolvedTheme: string | undefined,
    ) => ThemeChoice | undefined>('resolveActiveTheme');
    if (!resolveActiveTheme) return;

    expect(resolveActiveTheme('system', 'light')).toBe('light');
    expect(resolveActiveTheme('system', 'dark')).toBe('dark');
    expect(resolveActiveTheme('dark', 'light')).toBe('dark');
    expect(resolveActiveTheme(undefined, undefined)).toBeUndefined();
  });
});

describe('selectThemeChoice', () => {
  it('persists an explicit choice even when reduced-motion detection or audio fails', () => {
    const selectThemeChoice = requiredExport<(
      theme: ThemeChoice,
      dependencies: ThemeSelectionDependencies,
    ) => void>('selectThemeChoice');
    if (!selectThemeChoice) return;
    const setDark = vi.fn();
    const darkSound = vi.fn();

    selectThemeChoice('dark', {
      currentTheme: 'system',
      playSound: darkSound,
      prefersReducedMotion() {
        throw new Error('media queries unavailable');
      },
      setTheme: setDark,
    });

    expect(darkSound).not.toHaveBeenCalled();
    expect(setDark).toHaveBeenCalledWith('dark');

    const setLight = vi.fn();
    selectThemeChoice('light', {
      currentTheme: 'dark',
      playSound() {
        throw new Error('audio unavailable');
      },
      prefersReducedMotion: () => false,
      setTheme: setLight,
    });

    expect(setLight).toHaveBeenCalledWith('light');
  });

  it('does nothing when the explicit theme is already selected', () => {
    const selectThemeChoice = requiredExport<(
      theme: ThemeChoice,
      dependencies: ThemeSelectionDependencies,
    ) => void>('selectThemeChoice');
    if (!selectThemeChoice) return;
    const playSound = vi.fn();
    const setTheme = vi.fn();

    selectThemeChoice('dark', {
      currentTheme: 'dark',
      playSound,
      prefersReducedMotion: () => false,
      setTheme,
    });

    expect(playSound).not.toHaveBeenCalled();
    expect(setTheme).not.toHaveBeenCalled();
  });
});

describe('theme switch sound', () => {
  it('schedules one soft, direction-specific two-tone envelope under 120ms', () => {
    const light = audioContextStub();
    const dark = audioContextStub();

    scheduleThemeToggleSound(light.context as unknown as AudioContext, 'light');
    scheduleThemeToggleSound(dark.context as unknown as AudioContext, 'dark');

    for (const sound of [light, dark]) {
      expect(sound.context.createOscillator).toHaveBeenCalledOnce();
      expect(sound.context.createGain).toHaveBeenCalledOnce();
      expect(sound.oscillator.connect).toHaveBeenCalledWith(sound.gainNode);
      expect(sound.gainNode.connect).toHaveBeenCalledWith(sound.context.destination);
      expect(sound.oscillator.start).toHaveBeenCalledOnce();
      expect(sound.oscillator.stop).toHaveBeenCalledOnce();

      const startedAt = sound.oscillator.start.mock.calls[0]?.[0] ?? sound.context.currentTime;
      const stoppedAt = sound.oscillator.stop.mock.calls[0]?.[0] ?? Number.POSITIVE_INFINITY;
      expect(stoppedAt - startedAt).toBeLessThan(0.12);
      expect(stoppedAt - startedAt).toBeLessThan(0.15);

      const gainValues = sound.gain.events.map((event) => event.value);
      expect(Math.max(...gainValues)).toBeGreaterThan(0);
      expect(Math.max(...gainValues)).toBeLessThanOrEqual(0.08);
      expect(gainValues.at(-1)).toBe(0);
    }

    const lightFrequencies = light.frequency.events.map((event) => event.value);
    const darkFrequencies = dark.frequency.events.map((event) => event.value);
    expect(light.frequency.events.map((event) => event.method)).toEqual([
      'setValueAtTime',
      'setValueAtTime',
    ]);
    expect(dark.frequency.events.map((event) => event.method)).toEqual([
      'setValueAtTime',
      'setValueAtTime',
    ]);
    expect(lightFrequencies).toHaveLength(2);
    expect(darkFrequencies).toHaveLength(2);
    expect(lightFrequencies[1]).toBeGreaterThan(lightFrequencies[0]);
    expect(darkFrequencies[1]).toBeLessThan(darkFrequencies[0]);
    expect(lightFrequencies).not.toEqual(darkFrequencies);
  });

  it('creates one AudioContext lazily and reuses it', () => {
    const createThemeAudioContextGetter = requiredExport<
      (factory: () => AudioContext | null) => () => AudioContext | null
    >('createThemeAudioContextGetter');
    if (!createThemeAudioContextGetter) return;
    const audio = audioContextStub();
    const factory = vi.fn(() => audio.context as unknown as AudioContext);
    const getContext = createThemeAudioContextGetter(factory);

    expect(factory).not.toHaveBeenCalled();
    expect(getContext()).toBe(audio.context);
    expect(getContext()).toBe(audio.context);

    expect(factory).toHaveBeenCalledOnce();
  });

  it('silently tolerates blocked context and node construction', () => {
    const createThemeAudioContextGetter = requiredExport<
      (factory: () => AudioContext | null) => () => AudioContext | null
    >('createThemeAudioContextGetter');
    if (!createThemeAudioContextGetter) return;
    const blocked = createThemeAudioContextGetter(() => {
      throw new Error('blocked');
    });
    const brokenNodes = {
      createOscillator() {
        throw new Error('unavailable');
      },
    } as unknown as AudioContext;

    expect(blocked()).toBeNull();
    expect(() => scheduleThemeToggleSound(brokenNodes, 'dark')).not.toThrow();
  });
});
