import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { scheduleThemeToggleSound } from '@/lib/theme-toggle-sound';
import { ThemeIconSprite } from '@/components/theme-icon-sprite';
// @ts-expect-error The Vitest config exposes the stylesheet source as a virtual text module.
import styles from 'virtual:globals-css-source';
// @ts-expect-error Vite exposes local source files as text through the raw query.
import clientEnhancementsSource from './client-enhancements.tsx?raw';
// @ts-expect-error Vite exposes local source files as text through the raw query.
import themeSwitcherSource from './theme-switcher.tsx?raw';

import * as themeSwitcherModule from './theme-switcher';
import { iconSwapTransition } from './icon-swap';

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
  startViewTransition?(update: () => void): unknown;
  commitTheme?(update: () => void): void;
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
  it('renders one action-labelled control for the dark theme', () => {
    const Control = requiredExport<ComponentType<ThemeSwitcherControlProps>>(
      'ThemeSwitcherControl',
    );
    if (!Control) return;

    const darkMarkup = renderToStaticMarkup(
      createElement(Control, { activeTheme: 'dark', onSelect: vi.fn() }),
    );
    const buttons: string[] = darkMarkup.match(/<button[\s\S]*?<\/button>/g) ?? [];

    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toContain('theme-switcher-button');
    expect(buttons[0]).toContain('data-haptic="true"');
    expect(buttons[0]).toContain('data-slot="icon-swap"');
    expect(styles).toMatch(/\.theme-switcher-button\s*\{[\s\S]*width: 2\.25rem;[\s\S]*height: 2\.25rem;/);
    expect(styles).toMatch(/\.theme-switcher-button svg\s*\{[\s\S]*width: 1\.5rem;[\s\S]*height: 1\.5rem;/);
    expect(darkMarkup).toContain('aria-label="Switch to light theme"');
    expect(darkMarkup).toContain('data-icon-key="dark"');
    expect(darkMarkup).toContain('<use href="#theme-dark"');
    expect(darkMarkup).toContain('aria-live="polite"');
  });

  it('renders one action-labelled control for the light theme', () => {
    const Control = requiredExport<ComponentType<ThemeSwitcherControlProps>>(
      'ThemeSwitcherControl',
    );
    if (!Control) return;

    const lightMarkup = renderToStaticMarkup(
      createElement(Control, { activeTheme: 'light', onSelect: vi.fn() }),
    );
    const buttons: string[] = lightMarkup.match(/<button[\s\S]*?<\/button>/g) ?? [];

    expect(buttons).toHaveLength(1);
    expect(lightMarkup).toContain('aria-label="Switch to dark theme"');
    expect(lightMarkup).toContain('data-slot="icon-swap"');
    expect(lightMarkup).toContain('data-icon-key="light"');
    expect(lightMarkup).toContain('<use href="#theme-light"');
    expect(lightMarkup).toContain('aria-live="polite"');
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
  it('changes theme inside a view transition when motion is allowed', () => {
    const selectThemeChoice = requiredExport<(
      theme: ThemeChoice,
      dependencies: ThemeSelectionDependencies,
    ) => void>('selectThemeChoice');
    if (!selectThemeChoice) return;
    const setTheme = vi.fn();
    const order: string[] = [];
    const startViewTransition = vi.fn((update: () => void) => {
      order.push('transition');
      update();
    });

    selectThemeChoice('dark', {
      currentTheme: 'light',
      playSound: vi.fn(),
      prefersReducedMotion: () => false,
      setTheme,
      startViewTransition,
      commitTheme(update) {
        order.push('commit');
        update();
      },
    });

    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(order).toEqual(['transition', 'commit']);
  });

  it('reserves the compact control footprint before the client module resolves', () => {
    expect(themeSwitcherSource.match(/<div className="flex size-9" \/>/g)).toHaveLength(2);
    expect(clientEnhancementsSource).toContain(
      'loading: () => <div className="flex size-9" />',
    );
  });

  it('changes theme immediately when reduced motion is requested', () => {
    const selectThemeChoice = requiredExport<(
      theme: ThemeChoice,
      dependencies: ThemeSelectionDependencies,
    ) => void>('selectThemeChoice');
    if (!selectThemeChoice) return;
    const setTheme = vi.fn();
    const startViewTransition = vi.fn();

    selectThemeChoice('light', {
      currentTheme: 'dark',
      playSound: vi.fn(),
      prefersReducedMotion: () => true,
      setTheme,
      startViewTransition,
    });

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(setTheme).toHaveBeenCalledWith('light');
  });

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

describe('circle blur top-left transition styles', () => {
  it('keeps the vendored blurred top-left mask and 350vmax end size', () => {
    expect(styles).toContain('::view-transition-old(root)');
    expect(styles).toContain('::view-transition-new(root)');
    expect(styles).toContain('<feGaussianBlur stdDeviation="2"/>');
    expect(styles).toContain("top left / 0 no-repeat");
    expect(styles).toMatch(/transform-origin:\s*top left/);
    expect(styles).toMatch(/mask-size:\s*350vmax/);
  });
});

describe('IconSwap motion preference', () => {
  it('uses the Motion reduced-motion signal to disable its spring', () => {
    expect(iconSwapTransition(true)).toEqual({ duration: 0 });
    expect(iconSwapTransition(false)).toMatchObject({
      type: 'spring',
      duration: 0.3,
      bounce: 0,
    });
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
