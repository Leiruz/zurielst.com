import profile from '../../../content/profile.json';
import { normalizeText } from './normalize';

const MAX_ANSWER_CHARACTERS = 4000;
const SG_PHONE_PATTERN = /(\+?65[ -]?)?[89]\d{3}[ -]?\d{4}/u;
const EXPLICIT_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/iu;
const EXPLICIT_SCHEME_START_PATTERN = /(?<![./\\])\b[a-z][a-z\d+.-]*:(?=[^\s<>"'])/giu;
const SCHEME_RELATIVE_START_PATTERN = /(?<![:/])\/\/(?=[^\s/])/gu;
const BARE_DOMAIN_START_PATTERN = /(?<![/\\?#=&.@\p{L}\p{N}\p{M}\p{Extended_Pictographic}_-])(?=[^\s./\\?#=&@<>"'(),]+\.(?:xn--[a-z\d](?:[a-z\d-]{0,57}[a-z\d])?|\p{L}[\p{L}\p{M}]{1,62}))/giu;
const IDN_TLD_START_PATTERN = /(?<![/\\?#=&.@\p{L}\p{N}\p{M}\p{Extended_Pictographic}_-])(?=[^\s./\\?#=&@<>"'(),]+\.(?:[\p{L}\p{M}]|%[a-f\d]{2}){2,})/giu;
const IPV4_START_PATTERN = /(?<![/\\?#=&.@\p{L}\p{N}\p{M}_-])(?=(?:\d{1,3}\.){3}\d{1,3})/gu;
const PATHED_NUMERIC_HOST_START_PATTERN = /(?<![:/\\?#=&.@\p{L}\p{N}\p{M}_-])(?=(?:0x[a-f\d]+|\d+)(?:\.(?:0x[a-f\d]+|\d+)){0,3}(?::\d{1,5})?[/?#])/giu;
const IPV6_START_PATTERN = /(?<![/\\?#=&\p{L}\p{N}\p{M}_-])(?=\[[a-f\d:.]+\])/giu;
const USERINFO_URL_START_PATTERN = /(?<![/\\?#=&.@\p{L}\p{N}\p{M}_-])(?=[^\s/@<>"'(),]+@[^\s/@<>"'(),]+[/?#])/gu;
const URL_TOKEN_PATTERN = /^[^\s<>"']+/u;
const URL_DOMAIN_SEPARATOR_PATTERN = /[\u3002\uFF0E\uFF61]/gu;
const ENCODED_UNICODE_DOMAIN_SEPARATOR_PATTERN = /%e3%80%82|%ef%bc%8e|%ef%bd%a1/giu;
const PERCENT_ENCODED_BYTE_PATTERN = /%([a-f\d]{2})/giu;
const URL_UNRESERVED_ASCII_PATTERN = /^[a-z\d._~-]$/iu;
const ENCODED_PATH_BOUNDARY_PATTERN = /%(?:25|2e|2f|5c)/iu;
const DOTTED_TECHNOLOGY_TERMS = new Set(['ASP.NET', 'Node.js', 'wow.js']);
const URL_START_PATTERNS = [
  EXPLICIT_SCHEME_START_PATTERN,
  SCHEME_RELATIVE_START_PATTERN,
  BARE_DOMAIN_START_PATTERN,
  IDN_TLD_START_PATTERN,
  IPV4_START_PATTERN,
  PATHED_NUMERIC_HOST_START_PATTERN,
  IPV6_START_PATTERN,
  USERINFO_URL_START_PATTERN,
] as const;
const ALLOWED_EMAIL = 'zurielst@u.nus.edu';
const ALLOWED_EMAIL_LOCAL = 'zurielst';
const URL_BASE = 'https://zurielst.com/';
const EMAIL_LOCAL_CHARACTER = /[\p{L}\p{N}\p{M}.!#$%&'*+/=?^_`{|}~-]/u;
const DOMAIN_LABEL_CHARACTER = /[\p{L}\p{N}\p{M}-]/u;
const DOMAIN_SEPARATOR_CHARACTER = /[.\u3002\uFF0E\uFF61]/u;

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
  if (ENCODED_PATH_BOUNDARY_PATTERN.test(url.pathname)) {
    return false;
  }

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
  const trimmed = match.replace(/[),.!?;\]]+$/u, '');
  if (trimmed !== match) {
    candidates.push(trimmed);
  }
  return candidates;
}

function isAllowedUrlMatch(match: string): boolean {
  return urlCandidates(match).some((candidate) => {
    try {
      const parsed = EXPLICIT_SCHEME_PATTERN.test(candidate)
        ? new URL(candidate)
        : new URL(candidate.startsWith('//') ? candidate : `//${candidate}`, URL_BASE);
      return isAllowedUrl(parsed);
    } catch {
      return false;
    }
  });
}

function isDottedTechnology(match: string): boolean {
  return urlCandidates(match).some((candidate) => DOTTED_TECHNOLOGY_TERMS.has(candidate));
}

function canonicalizeUrlText(value: string): string {
  const decodedSeparators = value.replace(ENCODED_UNICODE_DOMAIN_SEPARATOR_PATTERN, '.');
  const decodedUnreserved = decodedSeparators.replace(
    PERCENT_ENCODED_BYTE_PATTERN,
    (encoded, hex: string) => {
      const character = String.fromCharCode(Number.parseInt(hex, 16));
      return URL_UNRESERVED_ASCII_PATTERN.test(character) ? character : encoded;
    },
  );
  return decodedUnreserved.replace(URL_DOMAIN_SEPARATOR_PATTERN, '.');
}

function hasDisallowedUrl(value: string): boolean {
  const canonicalValue = canonicalizeUrlText(value);

  // Scan URL starts independently so a greedy allowed token cannot hide a later URL.
  for (const pattern of URL_START_PATTERNS) {
    for (const start of canonicalValue.matchAll(pattern)) {
      const token = canonicalValue.slice(start.index).match(URL_TOKEN_PATTERN)?.[0];
      if (
        token !== undefined
        && !isDottedTechnology(token)
        && !isAllowedUrlMatch(token)
      ) {
        return true;
      }
    }
  }
  return false;
}

function hasDisallowedEmail(value: string): boolean {
  const lower = value.toLowerCase();
  for (let at = lower.indexOf('@'); at !== -1; at = lower.indexOf('@', at + 1)) {
    const start = at - ALLOWED_EMAIL_LOCAL.length;
    const end = start + ALLOWED_EMAIL.length;
    const before = start > 0 ? lower[start - 1] : undefined;
    const after = lower[end];
    const afterNext = lower[end + 1];
    const hasDomainContinuation = after !== undefined && (
      DOMAIN_LABEL_CHARACTER.test(after)
      || (
        DOMAIN_SEPARATOR_CHARACTER.test(after)
        && afterNext !== undefined
        && DOMAIN_LABEL_CHARACTER.test(afterNext)
      )
    );

    if (
      start < 0
      || lower.slice(start, end) !== ALLOWED_EMAIL
      || (before !== undefined && EMAIL_LOCAL_CHARACTER.test(before))
      || hasDomainContinuation
    ) {
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

  if (hasDisallowedEmail(normalized) || hasDisallowedEmail(answer)) {
    return { safe: false, reason: 'email' };
  }

  if (hasDisallowedUrl(normalized) || hasDisallowedUrl(answer)) {
    return { safe: false, reason: 'url' };
  }

  return { safe: true, answer };
}
