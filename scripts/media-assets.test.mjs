import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const packageLock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const outputs = {
  card: new URL('../public/media/loops/card.mp4', import.meta.url),
  hero: new URL('../public/media/loops/hero.mp4', import.meta.url),
  og: new URL('../public/og.png', import.meta.url),
};

async function readRequired(url, encoding) {
  try {
    return await readFile(url, encoding);
  } catch (error) {
    assert.fail(`required media artifact is missing: ${url.pathname} (${error.code})`);
  }
}

function probeVideo(url) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npx, [
    'remotion',
    'ffprobe',
    relative(repoRoot, fileURLToPath(url)).replaceAll('\\', '/'),
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=codec_name,width,height,pix_fmt,color_space,color_transfer,color_primaries:format=duration',
    '-of',
    'json',
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function probeRemotionVersions() {
  const cli = fileURLToPath(new URL('../node_modules/@remotion/cli/remotion-cli.js', import.meta.url));
  return spawnSync(process.execPath, [cli, 'versions'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

test('pins the reproducible Remotion toolchain and exposes the render command', () => {
  assert.equal(packageJson.devDependencies.remotion, '4.0.518');
  assert.equal(packageJson.devDependencies['@remotion/cli'], '4.0.518');
  assert.equal(packageJson.dependencies.zod, '4.4.3');
  assert.equal(packageLock.packages[''].devDependencies.remotion, '4.0.518');
  assert.equal(packageLock.packages[''].devDependencies['@remotion/cli'], '4.0.518');
  assert.equal(packageLock.packages[''].dependencies.zod, '4.4.3');
  assert.equal(packageLock.packages['node_modules/remotion'].version, '4.0.518');
  assert.equal(packageLock.packages['node_modules/@remotion/cli'].version, '4.0.518');
  assert.equal(packageLock.packages['node_modules/zod'].version, '4.4.3');
  assert.equal(packageJson.scripts['media:render'], 'node remotion/render.mjs');
  assert.match(packageJson.scripts.test, /node --test[\s\S]*scripts\/media-assets\.test\.mjs/);
});

test('keeps the installed Remotion toolchain version-compatible', () => {
  const result = probeRemotionVersions();
  const output = `${result.stdout}${result.stderr}`;

  assert.ifError(result.error);
  assert.equal(result.status, 0, output);
  assert.doesNotMatch(output, /version mismatch|incorrect versions|wrong versions/i);
});

test('uses the binding dark dossier palette', async () => {
  const designSource = await readRequired(new URL('../remotion/src/design.tsx', import.meta.url), 'utf8');
  assert.match(designSource, /canvas: '#09090a'/);
  assert.match(designSource, /accent: '#4b7bff'/);
  assert.doesNotMatch(designSource, /#f2f0ea|#1f67d2/i);
});

test('renders the still and both muted H.264 loops with deterministic settings', async () => {
  const renderSource = await readRequired(new URL('../remotion/render.mjs', import.meta.url), 'utf8');
  assert.match(renderSource, /\['still',[\s\S]*?'og-card'[\s\S]*?'public\/og\.png'/);
  assert.match(renderSource, /\['render',[\s\S]*?'hero-loop'[\s\S]*?'public\/media\/loops\/hero\.mp4'/);
  assert.match(renderSource, /\['render',[\s\S]*?'card-loop'[\s\S]*?'public\/media\/loops\/card\.mp4'/);
  assert.match(renderSource, /--codec=h264/);
  assert.match(renderSource, /--pixel-format=yuv420p/);
  assert.match(renderSource, /--color-space=bt709/);
  assert.match(renderSource, /--image-format=png/);
  assert.match(renderSource, /--muted/);
  assert.match(renderSource, /--video-bitrate=1M/);
  assert.match(renderSource, /--video-bitrate=500K/);
  assert.doesNotMatch(renderSource, /--crf/);
  assert.match(renderSource, /shell: process\.platform === 'win32'/);
});

test('registers the required still and loop compositions', async () => {
  const rootSource = await readRequired(new URL('../remotion/src/root.tsx', import.meta.url), 'utf8');
  assert.match(rootSource, /<Still[\s\S]*?id="og-card"[\s\S]*?width=\{1200\}[\s\S]*?height=\{630\}/);
  assert.match(rootSource, /<Composition[\s\S]*?id="hero-loop"[\s\S]*?durationInFrames=\{210\}[\s\S]*?fps=\{30\}[\s\S]*?width=\{640\}[\s\S]*?height=\{360\}/);
  assert.match(rootSource, /<Composition[\s\S]*?id="card-loop"[\s\S]*?durationInFrames=\{180\}[\s\S]*?fps=\{30\}[\s\S]*?width=\{640\}[\s\S]*?height=\{360\}/);
});

test('keeps the card rotation periodic and hero labels source-safe', async () => {
  const [cardSource, heroSource] = await Promise.all([
    readRequired(new URL('../remotion/src/card-loop.tsx', import.meta.url), 'utf8'),
    readRequired(new URL('../remotion/src/hero-loop.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(cardSource, /const squareRotation = \(frame \/ durationInFrames\) \* 90/);
  assert.match(cardSource, /rotate: `\$\{squareRotation\}deg`/);
  assert.doesNotMatch(cardSource, /phase \* 8/);
  assert.doesNotMatch(heroSource, /Â/);
});

test('produces a valid 1200 by 630 PNG within the decimal byte budget', async () => {
  const png = await readRequired(outputs.og);
  assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.ok(png.byteLength <= 300_000, `og.png is ${png.byteLength} bytes`);
});

test('produces valid H.264 MP4 loops within individual and total budgets', async () => {
  const [hero, card] = await Promise.all([readRequired(outputs.hero), readRequired(outputs.card)]);

  for (const [name, video] of [['hero.mp4', hero], ['card.mp4', card]]) {
    assert.equal(video.subarray(4, 8).toString('ascii'), 'ftyp', `${name} has no ftyp box`);
    assert.ok(video.includes(Buffer.from('avc1')), `${name} has no avc1 marker`);
  }

  assert.ok(hero.byteLength <= 1_500_000, `hero.mp4 is ${hero.byteLength} bytes`);
  assert.ok(card.byteLength <= 800_000, `card.mp4 is ${card.byteLength} bytes`);
  assert.ok(hero.byteLength + card.byteLength <= 8_000_000, 'combined video exceeds 8 MB');
});

test('encodes both loops with the required H.264 video metadata', () => {
  for (const [name, url, expectedDuration] of [
    ['hero.mp4', outputs.hero, 7],
    ['card.mp4', outputs.card, 6],
  ]) {
    const metadata = probeVideo(url);
    const stream = metadata.streams[0];
    assert.equal(stream.codec_name, 'h264', `${name} codec`);
    assert.equal(stream.width, 640, `${name} width`);
    assert.equal(stream.height, 360, `${name} height`);
    assert.equal(stream.pix_fmt, 'yuv420p', `${name} pixel format`);
    assert.equal(stream.color_space, 'bt709', `${name} color space`);
    assert.equal(stream.color_transfer, 'bt709', `${name} color transfer`);
    assert.equal(stream.color_primaries, 'bt709', `${name} color primaries`);
    assert.ok(Math.abs(Number(metadata.format.duration) - expectedDuration) <= 0.05, `${name} duration`);
  }
});
