const HOMOGLYPHS: Readonly<Record<string, string>> = {
  '\u0391': 'A',
  '\u0410': 'A',
  '\u0392': 'B',
  '\u0412': 'B',
  '\u0395': 'E',
  '\u0415': 'E',
  '\u0397': 'H',
  '\u041d': 'H',
  '\u0399': 'I',
  '\u0406': 'I',
  '\u039a': 'K',
  '\u041a': 'K',
  '\u039c': 'M',
  '\u041c': 'M',
  '\u039d': 'N',
  '\u039f': 'O',
  '\u041e': 'O',
  '\u03a1': 'P',
  '\u0420': 'P',
  '\u0421': 'C',
  '\u03a4': 'T',
  '\u0422': 'T',
  '\u03a5': 'Y',
  '\u03a7': 'X',
  '\u0425': 'X',
  '\u03b1': 'a',
  '\u0430': 'a',
  '\u03b5': 'e',
  '\u0435': 'e',
  '\u0441': 'c',
  '\u03bf': 'o',
  '\u043e': 'o',
  '\u03c1': 'p',
  '\u0440': 'p',
  '\u03c4': 't',
  '\u0442': 't',
  '\u03c5': 'y',
  '\u0443': 'y',
  '\u03c7': 'x',
  '\u0445': 'x',
  '\u0456': 'i',
  '\u0458': 'j',
  '\u0455': 's',
  '\u04bb': 'h',
  '\u04cf': 'l',
  '\u0433': 'r',
};

const DEFAULT_IGNORABLES = /\p{Default_Ignorable_Code_Point}+/gu;

/** Canonicalizes confusable Latin text before security checks. */
export function normalizeText(value: string): string {
  const visible = value.normalize('NFKC').replace(DEFAULT_IGNORABLES, '');
  return Array.from(visible, (character) => HOMOGLYPHS[character] ?? character)
    .join('')
    .replace(/\s+/gu, ' ')
    .trim();
}
