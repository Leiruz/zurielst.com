import 'server-only';

import { statSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export function hasPublicMedia(mediaPath: string | null | undefined): boolean {
  if (!mediaPath) return false;

  const relativePath = mediaPath.replace(/^\/+/, '');
  if (!relativePath.startsWith('media/')) return false;

  const mediaRoot = resolve(process.cwd(), 'public', 'media');
  const candidatePath = resolve(process.cwd(), 'public', relativePath);
  if (!candidatePath.startsWith(`${mediaRoot}${sep}`)) return false;

  try {
    return statSync(candidatePath).isFile();
  } catch {
    return false;
  }
}
