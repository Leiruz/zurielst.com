import { normalizeText } from './normalize';

const INJECTION_PHRASES = [
  'ignore previous instructions',
  'disregard the system prompt',
  'you are now',
  'reveal your prompt',
  'act as',
  'jailbreak',
  'developer mode',
] as const;

function phrasePattern(phrase: string): RegExp {
  const letters = Array.from(phrase, (character) => (character === ' ' ? '\\s*' : `${character}\\s*`)).join('');
  return new RegExp(`(?:^|\\b)${letters}(?=$|\\b)`, 'u');
}

const INJECTION_PATTERNS = INJECTION_PHRASES.map((phrase) => ({ phrase, pattern: phrasePattern(phrase) }));

export type InjectionResult = { matched: true; phrase: string } | { matched: false };

/** Finds prompt-injection phrases after shared Unicode and whitespace normalization. */
export function findInjection(value: string): InjectionResult {
  const normalized = normalizeText(value).toLowerCase();
  for (const { phrase, pattern } of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return { matched: true, phrase };
    }
  }
  return { matched: false };
}
