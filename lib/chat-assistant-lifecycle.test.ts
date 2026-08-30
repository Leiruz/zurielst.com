import { afterEach, describe, expect, it, vi } from 'vitest';

type EffectCleanup = void | (() => void);

interface CapturedEffect {
  create: () => EffectCleanup;
  dependencies?: readonly unknown[];
}

function createBody() {
  let lockWrites = 0;
  const dataset = new Proxy<{ chat?: string; chatOpen?: string }>({}, {
    set(target, property, value) {
      if (property === 'chat') lockWrites += 1;
      return Reflect.set(target, property, value);
    },
  });

  return {
    body: {
      dataset,
      style: { overflow: 'auto' },
    },
    lockWrites: () => lockWrites,
  };
}

afterEach(() => {
  vi.doUnmock('react');
  vi.doUnmock('@/components/dossier/use-prefers-reduced-motion');
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('chat assistant shell lifecycle', () => {
  it('contains focus and locks the mobile sheet before the deferred panel resolves', async () => {
    const actualReact = await vi.importActual<typeof import('react')>('react');
    let effects: CapturedEffect[] = [];
    let refs: Array<{ current: unknown }> = [];
    let stateValues: unknown[] = [];
    let refIndex = 0;
    let stateIndex = 0;

    function useEffect(
      create: () => EffectCleanup,
      dependencies?: readonly unknown[],
    ) {
      effects.push({ create, dependencies });
    }

    function useRef<T>(initialValue: T) {
      const index = refIndex++;
      refs[index] ??= { current: initialValue };
      return refs[index] as { current: T };
    }

    function useState<T>() {
      return [stateValues[stateIndex++] as T, vi.fn()] as const;
    }

    vi.doMock('react', () => ({ ...actualReact, useEffect, useRef, useState }));
    vi.doMock('@/components/dossier/use-prefers-reduced-motion', () => ({
      usePrefersReducedMotion: () => false,
    }));

    const { body } = createBody();
    const documentAddEventListener = vi.fn();
    const documentRemoveEventListener = vi.fn();
    vi.stubGlobal('document', {
      activeElement: null,
      addEventListener: documentAddEventListener,
      body,
      removeEventListener: documentRemoveEventListener,
    });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      matchMedia: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { ChatAssistant } = await import('@/components/chat/chat-assistant');
    stateValues = [true, null, false];
    ChatAssistant({
      intentChips: [],
      disclaimer: 'Public profile answers only.',
      reducedMotion: true,
    });
    const panelNode = {} as Node;
    const launcherNode = {} as Node;
    const outsideNode = {} as Node;
    let activeNode = outsideNode;
    const boundary = {
      contains: (target: Node | null) => target === panelNode || target === launcherNode,
    };
    refs[0]!.current = { focus: vi.fn() };
    refs[1]!.current = {
      focus: vi.fn(() => {
        activeNode = panelNode;
      }),
      parentElement: boundary,
    };

    const mountedEffects = effects.map((effect) => ({
      ...effect,
      cleanup: effect.create(),
    }));
    const openScrollEffect = mountedEffects.find(
      ({ dependencies }) => dependencies?.length === 1,
    );
    expect(openScrollEffect?.dependencies).toEqual([true]);
    const onFocusIn = documentAddEventListener.mock.calls.find(
      ([type]) => type === 'focusin',
    )?.[1] as ((event: FocusEvent) => void) | undefined;

    expect(onFocusIn).toBeTypeOf('function');
    onFocusIn?.({ target: outsideNode } as unknown as FocusEvent);
    expect(boundary.contains(activeNode)).toBe(true);

    activeNode = launcherNode;
    onFocusIn?.({ target: launcherNode } as unknown as FocusEvent);
    expect(activeNode).toBe(launcherNode);

    refs[0]!.current = null;
    activeNode = outsideNode;
    onFocusIn?.({ target: outsideNode } as unknown as FocusEvent);
    expect(activeNode).toBe(outsideNode);

    expect(body.dataset.chat).toBe('');
    expect(body.dataset).not.toHaveProperty('chatOpen');
    expect(body.style.overflow).toBe('auto');

    openScrollEffect?.cleanup?.();
    effects = [];
    stateValues = [false, null, false];
    refIndex = 0;
    stateIndex = 0;
    ChatAssistant({
      intentChips: [],
      disclaimer: 'Public profile answers only.',
      reducedMotion: true,
    });
    const closedScrollEffect = effects.find(
      ({ dependencies }) => dependencies?.length === 1,
    );
    expect(closedScrollEffect?.dependencies).toEqual([false]);
    const closedCleanup = closedScrollEffect?.create();
    expect(body.dataset.chat).toBeUndefined();
    expect(body.style.overflow).toBe('auto');
    if (typeof closedCleanup === 'function') closedCleanup();
    for (const effect of mountedEffects) {
      if (effect !== openScrollEffect && typeof effect.cleanup === 'function') {
        effect.cleanup();
      }
    }
    expect(documentRemoveEventListener).toHaveBeenCalledWith('focusin', onFocusIn);
  });

  it('marks the responsive body once when the resolved panel mounts', async () => {
    const actualReact = await vi.importActual<typeof import('react')>('react');
    let effects: CapturedEffect[] = [];
    let refs: Array<{ current: unknown }> = [];
    let stateValues: unknown[] = [];
    let refIndex = 0;
    let stateIndex = 0;

    function useEffect(
      create: () => EffectCleanup,
      dependencies?: readonly unknown[],
    ) {
      effects.push({ create, dependencies });
    }

    function useRef<T>(initialValue: T) {
      const index = refIndex++;
      refs[index] ??= { current: initialValue };
      return refs[index] as { current: T };
    }

    function useState<T>() {
      return [stateValues[stateIndex++] as T, vi.fn()] as const;
    }

    function render<T>(renderComponent: () => T, states: unknown[]) {
      effects = [];
      refs = [];
      stateValues = states;
      refIndex = 0;
      stateIndex = 0;
      renderComponent();
      return { effects, refs };
    }

    vi.doMock('react', () => ({ ...actualReact, useEffect, useRef, useState }));
    vi.doMock('@/components/dossier/use-prefers-reduced-motion', () => ({
      usePrefersReducedMotion: () => false,
    }));

    const { body, lockWrites } = createBody();
    const media = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const matchMedia = vi.fn(() => media);
    vi.stubGlobal('document', {
      activeElement: null,
      addEventListener: vi.fn(),
      body,
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      matchMedia,
      removeEventListener: vi.fn(),
    });

    const { ChatAssistant } = await import('@/components/chat/chat-assistant');
    const { Chat } = await import('@/components/chat/chat');
    const assistant = render(
      () => ChatAssistant({
        intentChips: [],
        disclaimer: 'Public profile answers only.',
        reducedMotion: true,
      }),
      [true, Chat, false],
    );
    assistant.refs[1]!.current = {
      focus: vi.fn(),
      parentElement: { contains: vi.fn(() => false) },
    };
    const assistantCleanups = assistant.effects
      .map(({ create }) => create())
      .filter((cleanup): cleanup is () => void => typeof cleanup === 'function');

    const panel = render(
      () => Chat({
        open: true,
        onClose: vi.fn(),
        intentChips: [],
        disclaimer: 'Public profile answers only.',
        reducedMotion: true,
      }),
      ['', [], false, 0],
    );
    const panelCleanups = panel.effects
      .map(({ create }) => create())
      .filter((cleanup): cleanup is () => void => typeof cleanup === 'function');

    expect(lockWrites()).toBe(1);
    expect(body.dataset.chat).toBe('');
    expect(body.dataset).not.toHaveProperty('chatOpen');

    for (const cleanup of [...panelCleanups, ...assistantCleanups]) cleanup();
    expect(body.dataset.chat).toBeUndefined();
  });
});
