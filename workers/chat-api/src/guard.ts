import profile from '../../../content/profile.json';
import { normalizeText } from './normalize';

const MAX_ANSWER_CHARACTERS = 4000;
const SG_PHONE_PATTERN = /(\+?65[ -]?)?[89]\d{3}[ -]?\d{4}/u;
const EMAIL_PATTERN = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*/giu;
const URL_PATTERN = /[a-z][a-z\d+.-]*:\/\/[^\s<>"']+/giu;
const ALLOWED_EMAIL = 'zurielst@u.nus.edu';

interface AllowedUrlPrefix {
  origin: string;
  path: string;
}

const PUBLICATION_PATHS = profile.proof_wall.publications.map((publication) => new URL(publication.link).pathname);

const ALLOWED_URL_PREFIXES: readonly AllowedUrlPrefix[] = [
  { origin: 'https://github.com', path: '/Leiruz' },
  { origin: 'https://www.linkedin.com', path: '/in/zuriel-shanley' },
  { origin: 'https://zurielst.com', path: '/' },
  { origin: 'https://citadel.zurielst.com', path: '/' },
  { origin: 'https://towerblock.zurielst.com', path: '/' },
  { origin: 'https://ngeeannbadminton.zurielst.com', path: '/' },
  ...PUBLICATION_PATHS.map((path) => ({ origin: 'https://drive.google.com', path })),
];

export type GuardResult =
  | { safe: true; answer: string }
  | { safe: false; reason: 'length' | 'phone' | 'email' | 'url' };

function isAllowedUrl(url: URL): boolean {
  return ALLOWED_URL_PREFIXES.some(({ origin, path }) => {
    if (url.origin !== origin) {
      return false;
    }
    if (path === '/') {
      return url.pathname.startsWith('/');
    }
    return url.pathname === path || url.pathname.startsWith(`${path}/`);
  });
}

function urlCandidates(match: string): string[] {
  const candidates = [match];
  const trimmed = match.replace(/[),.!?;:\]]+$/u, '');
  if (trimmed !== match) {
    candidates.push(trimmed);
  }
  return candidates;
}

function hasDisallowedUrl(value: string): boolean {
  for (const match of value.matchAll(URL_PATTERN)) {
    const allowed = urlCandidates(match[0]).some((candidate) => {
      try {
        return isAllowedUrl(new URL(candidate));
      } catch {
        return false;
      }
    });
    if (!allowed) {
      return true;
    }
  }
  return false;
}

/** Validates a complete model answer while preserving the original safe text. */
export function guardAnswer(answer: string): GuardResult {
  if (Array.from(answer).length > MAX_ANSWER_CHARACTERS) {
    return { safe: false, reason: 'length' };
  }

  const normalized = normalizeText(answer);
  if (SG_PHONE_PATTERN.test(normalized)) {
    return { safe: false, reason: 'phone' };
  }

  for (const email of normalized.matchAll(EMAIL_PATTERN)) {
    if (email[0].toLowerCase() !== ALLOWED_EMAIL) {
      return { safe: false, reason: 'email' };
    }
  }

  if (hasDisallowedUrl(normalized) || hasDisallowedUrl(answer)) {
    return { safe: false, reason: 'url' };
  }

  return { safe: true, answer };
}
