import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import Home from '@/app/page';
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
    const terminal = childWithType(page.props.children, Terminal);
    const main = childWithType(page.props.children, 'main');
    const contact = childWithType(main?.props.children, Contact);

    expect(terminal).toBeDefined();
    expect(contact).toBeDefined();
    expect(JSON.stringify(terminal?.props)).not.toContain(profile.easter_eggs.terminal.note);
    expect(JSON.stringify(contact?.props)).not.toContain(profile.easter_eggs.terminal.note);
  });
});
