import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { describe, expect, it, vi } from 'vitest';

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
    expect(source).toContain('event.target instanceof HTMLInputElement');
    expect(source).toContain('event.target instanceof HTMLTextAreaElement');
    expect(source).toContain('event.target.isContentEditable');
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
