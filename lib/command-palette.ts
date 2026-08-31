export type CommandPaletteGroup = 'Sections' | 'Actions' | 'Links';

interface CommandPaletteActionBase {
  id: string;
  group: CommandPaletteGroup;
  keywords: readonly string[];
  label: string;
  shortcut?: readonly [string, string];
}

export type CommandPaletteAction =
  | (CommandPaletteActionBase & {
      kind: 'section';
      targetId: string;
    })
  | (CommandPaletteActionBase & {
      download?: boolean;
      external?: boolean;
      href: string;
      kind: 'link';
    })
  | (CommandPaletteActionBase & { kind: 'terminal' })
  | (CommandPaletteActionBase & {
      kind: 'theme';
      theme: 'light' | 'dark';
    })
  | (CommandPaletteActionBase & {
      email: string;
      kind: 'copy';
    });

export interface CommandPaletteConfig {
  email: string;
  githubUrl: string;
  linkedInUrl: string;
  sourceUrl: string;
}

interface ActivationDependencies {
  close(restoreFocus?: boolean): void;
  copyText(text: string): Promise<void>;
  dispatchTerminalOpen(): void;
  findSection(id: string): { scrollIntoView(options: ScrollIntoViewOptions): void } | null;
  navigate(action: Extract<CommandPaletteAction, { kind: 'link' }>): void;
  reducedMotion: boolean;
  setTheme(theme: string): void;
  updateHash(hash: string): void;
}

interface TabEvent {
  key: string;
  shiftKey: boolean;
  preventDefault(): void;
}

interface CommandInputKeyDependencies {
  activate(action: CommandPaletteAction): void | Promise<void>;
  setSelectedIndex(index: number): void;
}

interface CommandDialogKeyDependencies {
  close(): void;
  trapTab(): void;
}

const SECTION_ACTIONS: readonly CommandPaletteAction[] = [
  { id: 'identity', group: 'Sections', keywords: ['home', 'about'], label: 'Identity', kind: 'section', targetId: 'identity', shortcut: ['g', 'i'] },
  { id: 'intro', group: 'Sections', keywords: ['hello', 'about', 'bio'], label: 'Introduction', kind: 'section', targetId: 'intro' },
  { id: 'contributions', group: 'Sections', keywords: ['github', 'activity', 'heatmap'], label: 'Contributions', kind: 'section', targetId: 'contributions' },
  { id: 'insights', group: 'Sections', keywords: ['analytics'], label: 'Insights', kind: 'section', targetId: 'insights' },
  { id: 'capabilities', group: 'Sections', keywords: ['skills', 'security', 'engineering'], label: 'Capabilities', kind: 'section', targetId: 'capabilities' },
  { id: 'stack', group: 'Sections', keywords: ['skills', 'tools', 'technologies'], label: 'Stack', kind: 'section', targetId: 'stack', shortcut: ['g', 's'] },
  { id: 'work', group: 'Sections', keywords: ['projects', 'case studies', 'portfolio'], label: 'Selected work', kind: 'section', targetId: 'work', shortcut: ['g', 'w'] },
  { id: 'timeline', group: 'Sections', keywords: ['experience', 'career', 'history'], label: 'Timeline', kind: 'section', targetId: 'timeline', shortcut: ['g', 't'] },
  { id: 'education', group: 'Sections', keywords: ['school', 'university', 'learning'], label: 'Education', kind: 'section', targetId: 'education', shortcut: ['g', 'e'] },
  { id: 'proof', group: 'Sections', keywords: ['proof', 'awards', 'certifications', 'evidence'], label: 'Accolades', kind: 'section', targetId: 'proof', shortcut: ['g', 'a'] },
  { id: 'products', group: 'Sections', keywords: ['tools', 'builds', 'software'], label: 'Products', kind: 'section', targetId: 'products', shortcut: ['g', 'p'] },
  { id: 'brands', group: 'Sections', keywords: ['vendors', 'technologies', 'worked with'], label: 'Brands', kind: 'section', targetId: 'brands' },
  { id: 'faq', group: 'Sections', keywords: ['questions', 'answers'], label: 'FAQ', kind: 'section', targetId: 'faq', shortcut: ['g', 'f'] },
  { id: 'contact', group: 'Sections', keywords: ['email', 'connect', 'hire'], label: 'Contact', kind: 'section', targetId: 'contact', shortcut: ['g', 'c'] },
];

export function createCommandPaletteActions(
  config: CommandPaletteConfig,
): CommandPaletteAction[] {
  return [
    ...SECTION_ACTIONS,
    { id: 'resume', group: 'Actions', keywords: ['cv', 'pdf', 'download'], label: 'Download resume', kind: 'link', href: '/media/resume.pdf', download: true },
    { id: 'vcard', group: 'Actions', keywords: ['contact', 'vcf', 'download'], label: 'Download vCard', kind: 'link', href: '/zurielst.vcf', download: true },
    { id: 'terminal', group: 'Actions', keywords: ['console', 'shell', 'command line'], label: 'Open terminal', kind: 'terminal' },
    { id: 'light-theme', group: 'Actions', keywords: ['light', 'appearance'], label: 'Light theme', kind: 'theme', theme: 'light' },
    { id: 'dark-theme', group: 'Actions', keywords: ['dark', 'appearance'], label: 'Dark theme', kind: 'theme', theme: 'dark' },
    { id: 'email', group: 'Actions', keywords: ['clipboard', 'contact', config.email], label: 'Copy email', kind: 'copy', email: config.email },
    { id: 'github', group: 'Links', keywords: ['code', 'repositories', 'profile'], label: 'GitHub', kind: 'link', href: config.githubUrl, external: true },
    { id: 'linkedin', group: 'Links', keywords: ['social', 'career', 'profile'], label: 'LinkedIn', kind: 'link', href: config.linkedInUrl, external: true },
    { id: 'source', group: 'Links', keywords: ['code', 'repository', 'website'], label: 'View source', kind: 'link', href: config.sourceUrl, external: true },
    { id: 'llms', group: 'Links', keywords: ['ai', 'profile', 'text'], label: 'llms.txt', kind: 'link', href: '/llms.txt', external: false },
  ];
}

export function filterCommandPaletteActions(
  actions: readonly CommandPaletteAction[],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...actions];

  return actions.filter((action) =>
    [action.label, ...action.keywords].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    ),
  );
}

export function moveCommandPaletteSelection(
  currentIndex: number,
  key: string,
  actionCount: number,
) {
  if (actionCount === 0) return -1;
  if (key === 'ArrowDown') return (currentIndex + 1 + actionCount) % actionCount;
  if (key === 'ArrowUp') return (currentIndex - 1 + actionCount) % actionCount;
  return Math.min(Math.max(currentIndex, 0), actionCount - 1);
}

export function keepCommandPaletteSelectionVisible(
  actionId: string | undefined,
  findOption: (id: string) => { scrollIntoView(options: ScrollIntoViewOptions): void } | null,
) {
  if (!actionId) return;
  findOption(`command-palette-option-${actionId}`)?.scrollIntoView({ block: 'nearest' });
}

export async function handleCommandPaletteInputKey(
  event: TabEvent,
  actions: readonly CommandPaletteAction[],
  selectedIndex: number,
  dependencies: CommandInputKeyDependencies,
) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    dependencies.setSelectedIndex(
      moveCommandPaletteSelection(selectedIndex, event.key, actions.length),
    );
    return;
  }

  if (event.key === 'Enter') {
    const action = actions[selectedIndex] ?? actions[0];
    if (!action) return;
    event.preventDefault();
    await dependencies.activate(action);
    return;
  }

}

export function handleCommandPaletteDialogKey(
  event: TabEvent,
  dependencies: CommandDialogKeyDependencies,
) {
  if (event.key === 'Escape') {
    event.preventDefault();
    dependencies.close();
    return;
  }

  if (event.key === 'Tab') dependencies.trapTab();
}

export async function activateCommandPaletteAction(
  action: CommandPaletteAction,
  dependencies: ActivationDependencies,
) {
  if (action.kind === 'section') {
    const section = dependencies.findSection(action.targetId);
    section?.scrollIntoView({
      behavior: dependencies.reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    dependencies.updateHash(`#${action.targetId}`);
    dependencies.close();
    return;
  }

  if (action.kind === 'terminal') {
    dependencies.close(false);
    dependencies.dispatchTerminalOpen();
    return;
  }

  if (action.kind === 'theme') {
    dependencies.setTheme(action.theme);
    dependencies.close();
    return;
  }

  if (action.kind === 'copy') {
    await dependencies.copyText(action.email);
    dependencies.close();
    return;
  }

  dependencies.navigate(action);
  dependencies.close();
}

export function trapCommandPaletteTab(
  event: TabEvent,
  dialog: HTMLDivElement | null,
  activeElement: Element | null,
) {
  if (event.key !== 'Tab') return;

  const focusable = dialog?.querySelectorAll<HTMLElement>(
    'input:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  );
  if (!focusable?.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
