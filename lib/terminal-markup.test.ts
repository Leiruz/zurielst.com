import { createElement, type ReactElement } from 'react';
// @ts-expect-error The installed react-dom runtime has no declaration package in this project.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { Terminal } from '@/components/terminal';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();

  return {
    ...actual,
    useState(initialState: unknown) {
      const [value, setValue] = actual.useState(initialState);
      return [initialState === false ? true : value, setValue] as const;
    },
  };
});

const profile = profileJson as Profile;
const terminalProps = {
  commands: profile.easter_eggs.terminal.commands,
  source: profile.easter_eggs.terminal.source,
  email: profile.identity.email,
  gamesUrl: profile.easter_eggs.towerblock.url,
  resumeAvailable: false,
};

function renderOpenTerminal(): {
  markup: string;
  terminalTree: ReactElement<Record<string, unknown>> | null;
} {
  let terminalTree: ReactElement<Record<string, unknown>> | null = null;

  function CaptureTerminal() {
    terminalTree = Terminal(terminalProps);
    return terminalTree;
  }

  const markup = renderToStaticMarkup(createElement(CaptureTerminal));

  return { markup, terminalTree };
}

function openTerminalMarkup() {
  return renderToStaticMarkup(
    createElement(Terminal, terminalProps),
  );
}

describe('Terminal visitor copy', () => {
  it('replaces the internal terminal note with a help hint', () => {
    const markup = openTerminalMarkup();

    expect(markup).toContain('Type help to list commands.');
    expect(markup).not.toContain(profile.easter_eggs.terminal.note);
  });
});

describe('Terminal focus', () => {
  it('puts initial focus on the command input when the dialog opens', () => {
    const markup = openTerminalMarkup();

    expect(markup).toMatch(/<input(?=[^>]*id="terminal-command")(?=[^>]*autofocus="")/);
  });

  it('restores focus after the backdrop click default action', () => {
    const { terminalTree } = renderOpenTerminal();

    expect(terminalTree?.props.onClick).toBeTypeOf('function');
    expect(terminalTree?.props.onMouseDown).toBeUndefined();
  });
});
