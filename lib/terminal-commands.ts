export type TerminalAction =
  | { type: 'scroll'; targetId: string }
  | { type: 'output'; text: string }
  | { type: 'open'; url: string }
  | { type: 'clear' };

export interface TerminalCommandContext {
  commands: readonly string[];
  email: string;
  resumeAvailable: boolean;
  gamesUrl: string;
}

const SCROLL_TARGETS: Readonly<Record<string, string>> = {
  about: 'identity',
  experience: 'timeline',
  education: 'timeline',
  projects: 'work',
  skills: 'capabilities',
  awards: 'proof',
  certifications: 'proof',
  products: 'products',
};

export function resolveTerminalCommand(
  input: string,
  context: TerminalCommandContext,
): TerminalAction {
  const command = input.trim().toLowerCase();
  const isConfigured = context.commands.includes(command);

  if (!isConfigured) {
    return {
      type: 'output',
      text: `command not found: ${command || '(empty)'}. Type help for available commands.`,
    };
  }

  const targetId = SCROLL_TARGETS[command];

  if (targetId) return { type: 'scroll', targetId };
  if (command === 'help') return { type: 'output', text: context.commands.join('  ') };
  if (command === 'contact') return { type: 'output', text: context.email };
  if (command === 'resume') {
    return context.resumeAvailable
      ? { type: 'open', url: '/media/resume.pdf' }
      : { type: 'output', text: 'resume: available on the live site' };
  }
  if (command === 'games') return { type: 'open', url: context.gamesUrl };
  if (command === 'clear') return { type: 'clear' };

  return { type: 'output', text: `command unavailable: ${command}. Type help for available commands.` };
}
