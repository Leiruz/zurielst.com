import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const styles = await readFile(new URL('../styles/globals.css', import.meta.url), 'utf8');
const rootTokens = /:root\s*\{([\s\S]*?)\n\}/.exec(styles)?.[1];
const darkTokens = /\.dark\s*\{([\s\S]*?)\n\}/.exec(styles)?.[1];
assert.ok(rootTokens, 'styles/globals.css must define a :root token block');
assert.ok(darkTokens, 'styles/globals.css must define a .dark token block');

function readHexToken(name, tokens = rootTokens) {
  const effectiveTokens = tokens.replace(/\/\*[\s\S]*?\*\//g, '');
  const value = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(effectiveTokens)?.[1];
  assert.ok(value, `:root must define --${name} as a six-digit hex color`);
  return value;
}

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/../g).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test('ignores commented light token declarations', () => {
  const tokens = `
    /* --text-3: #69707b; */
    --text-3: #6e7480;
  `;

  assert.equal(readHexToken('text-3', tokens), '#6e7480');
});

test('light --text-3 meets WCAG AA on canvas and card backgrounds', () => {
  const text = readHexToken('text-3');
  for (const backgroundName of ['canvas', 'canvas-raised', 'surface']) {
    const ratio = contrastRatio(text, readHexToken(backgroundName));
    assert.ok(ratio >= 4.5, `--text-3 contrast against --${backgroundName} is ${ratio.toFixed(3)}:1`);
  }
});

test('the shimmer base token meets WCAG AA against both header themes', () => {
  for (const [theme, tokens] of [['light', rootTokens], ['dark', darkTokens]]) {
    const ratio = contrastRatio(
      readHexToken('text-3', tokens),
      readHexToken('canvas', tokens),
    );
    assert.ok(ratio >= 4.5, `${theme} shimmer base contrast is ${ratio.toFixed(3)}:1`);
  }
  assert.match(styles, /\.shimmering-text\s*\{[\s\S]*?var\(--text-3\)/);
});
