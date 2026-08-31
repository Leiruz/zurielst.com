import {
  Children,
  createElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
// @ts-expect-error The Vitest config exposes the stylesheet source as a virtual text module.
import styles from 'virtual:globals-css-source';

import Home from '@/app/page';
import { ChatAssistant } from '@/components/chat/chat-assistant';
import { CommandPaletteLoader } from '@/components/command-palette-loader';
import { Contact } from '@/components/sections/contact';
import { Terminal } from '@/components/terminal';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';

vi.mock('server-only', () => ({}));

const profile = profileJson as Profile;

function childWithType(
  children: unknown,
  type: ReactElement['type'],
): ReactElement<Record<string, unknown>> | undefined {
  return Children.toArray(children as ReactNode).find(
    (child): child is ReactElement<Record<string, unknown>> =>
      isValidElement(child) && child.type === type,
  );
}

describe('page client boundaries', () => {
  it('does not serialize the internal terminal note into client props', () => {
    const page = Home();
    const shell = childWithType(page.props.children, 'div');
    const terminal = childWithType(shell?.props.children, Terminal);
    const main = childWithType(shell?.props.children, 'main');
    const contact = childWithType(main?.props.children, Contact);

    expect(page.type).toBe(Fragment);
    expect(shell).toBeDefined();
    expect(terminal).toBeDefined();
    expect(contact).toBeDefined();
    expect(JSON.stringify(terminal?.props)).not.toContain(profile.easter_eggs.terminal.note);
    expect(JSON.stringify(contact?.props)).not.toContain(profile.easter_eggs.terminal.note);
  });

  it('mounts one page-root assistant and keeps chat payloads out of Contact', () => {
    const page = Home();
    const pageChildren = Children.toArray(page.props.children as ReactNode);
    const assistantRoots = pageChildren.filter(
      (child): child is ReactElement<Record<string, unknown>> =>
        isValidElement(child) && child.type === ChatAssistant,
    );
    const shell = childWithType(page.props.children, 'div');
    const main = childWithType(shell?.props.children, 'main');
    const contact = childWithType(main?.props.children, Contact);

    expect(assistantRoots).toHaveLength(1);
    expect(shell).toBeDefined();
    expect(assistantRoots[0]?.props.disclaimer).toBe(profile.chat.disclaimer);
    expect(assistantRoots[0]?.props.intentChips).toEqual(
      profile.chat.intent_chips.slice(0, 4),
    );
    expect(contact).toBeDefined();
    expect(contact?.props).not.toHaveProperty('disclaimer');
    expect(contact?.props).not.toHaveProperty('intentChips');
  });

  it('keeps global dialog launches mutually exclusive in the inline bootstrap', () => {
    const page = Home();
    const shell = childWithType(page.props.children, 'div');
    const script = childWithType(shell?.props.children, 'script');
    const source = String(
      (script?.props.dangerouslySetInnerHTML as { __html?: string } | undefined)?.__html,
    );

    expect(source).toContain('dossier:chat-open');
    expect(source).toContain('dossier:command-palette-open');
    expect(source).toContain('dossier:terminal-open');
    expect(source).toContain('.chat-launcher[aria-expanded=');
  });

  it('server-renders one initially hidden return-to-top control in the inline bootstrap', () => {
    const markup = renderToStaticMarkup(createElement(Home));

    expect(markup.match(/aria-label="Return to top"/g) ?? []).toHaveLength(1);
    expect(markup).toContain('data-return-to-top="true"');
    expect(markup).toContain('data-visible="false"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toMatch(/<button[^>]*data-return-to-top="true"[^>]*>[\s\S]*?<svg[^>]*aria-hidden="true"/);
    expect(markup).toContain('installReturnToTop');
    expect(markup).toContain('document.querySelector("[data-return-to-top]")');
  });

  it('sizes and stacks the return control and hides it while chat is open', () => {
    expect(styles).toMatch(/\.return-to-top\s*\{[\s\S]*?width:\s*var\(--chat-fab-size\);[\s\S]*?height:\s*var\(--chat-fab-size\);/);
    expect(styles).toContain('bottom: calc(var(--chat-edge) + env(safe-area-inset-bottom, 0px) + var(--chat-fab-size) + 0.5rem);');
    expect(styles).toMatch(/\.return-to-top\s*\{[\s\S]*?transition:\s*opacity 150ms/);
    expect(styles).toMatch(/\.return-to-top\[data-visible='false'\]\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?pointer-events:\s*none;/);
    expect(styles).toMatch(/body\[data-chat\]\s+\.return-to-top\s*\{[\s\S]*?display:\s*none;/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.return-to-top\s*\{[\s\S]*?transition:\s*none !important;/);
  });

  it('embeds the nine guarded global g-key section sequences in excluded inline code', () => {
    const page = Home();
    const shell = childWithType(page.props.children, 'div');
    const script = childWithType(shell?.props.children, 'script');
    const source = String(
      (script?.props.dangerouslySetInnerHTML as { __html?: string } | undefined)?.__html,
    );

    for (const [key, targetId] of Object.entries({
      i: 'identity',
      w: 'work',
      s: 'stack',
      t: 'timeline',
      e: 'education',
      a: 'proof',
      p: 'products',
      f: 'faq',
      c: 'contact',
    })) {
      expect(source).toContain(`"${key}":"${targetId}"`);
    }
    expect(source).toContain('event.key.toLowerCase()');
    expect(source).toContain('target instanceof HTMLInputElement');
    expect(source).toContain('target instanceof HTMLTextAreaElement');
    expect(source).toContain('target.isContentEditable');
    expect(source).toContain('dataset.intro !== "done"');
    expect(source).toContain('[role="dialog"][aria-modal="true"]');
    expect(source).toContain('#dossier-chat-dialog[data-state="open"]');
    for (const guard of ['event.ctrlKey', 'event.altKey', 'event.metaKey', 'event.shiftKey', 'event.repeat']) {
      expect(source).toContain(guard);
    }
    expect(source).toContain('goPrefix');
  });

  it('passes tracked social profiles and untracked internal resources to the palette', () => {
    const page = Home();
    const shell = childWithType(page.props.children, 'div');
    const palette = childWithType(shell?.props.children, CommandPaletteLoader);

    expect(palette?.props.githubUrl).toBe('https://github.com/Leiruz?utm_source=zurielst.com');
    expect(palette?.props.linkedInUrl).toBe(
      'https://www.linkedin.com/in/zuriel-shanley/?utm_source=zurielst.com',
    );
    expect(palette?.props.sourceUrl).toBe('https://github.com/Leiruz/zurielst.com');
  });
});
