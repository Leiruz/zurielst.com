import { describe, expect, it } from 'vitest';
import { resolveTerminalCommand } from './terminal-commands';

const context = {
  commands: [
    'help',
    'about',
    'experience',
    'education',
    'projects',
    'skills',
    'contact',
    'resume',
    'awards',
    'products',
    'games',
    'certifications',
    'clear',
  ],
  email: 'person@example.com',
  resumeAvailable: false,
  gamesUrl: 'https://games.example.com',
} as const;

describe('resolveTerminalCommand', () => {
  it.each([
    ['about', 'identity'],
    ['experience', 'timeline'],
    ['education', 'timeline'],
    ['projects', 'work'],
    ['skills', 'capabilities'],
    ['awards', 'proof'],
    ['certifications', 'proof'],
    ['products', 'products'],
  ])('maps %s to the %s section', (command, targetId) => {
    expect(resolveTerminalCommand(command, context)).toEqual({ type: 'scroll', targetId });
  });

  it('lists only the accepted commands for help', () => {
    expect(resolveTerminalCommand(' HELP ', context)).toEqual({
      type: 'output',
      text: context.commands.join('  '),
    });
  });

  it('prints the profile email for contact', () => {
    expect(resolveTerminalCommand('contact', context)).toEqual({
      type: 'output',
      text: context.email,
    });
  });

  it('reports the exact live-site message when resume media is absent', () => {
    expect(resolveTerminalCommand('resume', context)).toEqual({
      type: 'output',
      text: 'resume: available on the live site',
    });
  });

  it('opens the resume path when resume media exists', () => {
    expect(resolveTerminalCommand('resume', { ...context, resumeAvailable: true })).toEqual({
      type: 'open',
      url: '/media/resume.pdf',
    });
  });

  it('opens the profile game URL', () => {
    expect(resolveTerminalCommand('games', context)).toEqual({
      type: 'open',
      url: context.gamesUrl,
    });
  });

  it('clears scrollback', () => {
    expect(resolveTerminalCommand('clear', context)).toEqual({ type: 'clear' });
  });

  it('returns useful output for an unknown command', () => {
    expect(resolveTerminalCommand('launch', context)).toEqual({
      type: 'output',
      text: 'command not found: launch. Type help for available commands.',
    });
  });

  it('rejects a mapped command omitted from the configured command list', () => {
    const commands = context.commands.filter((command) => command !== 'about');

    expect(resolveTerminalCommand('about', { ...context, commands })).toEqual({
      type: 'output',
      text: 'command not found: about. Type help for available commands.',
    });
  });
});
