import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const tasks = [
  ['still', 'remotion/src/index.tsx', 'og-card', 'public/og.png', '--config=remotion/remotion.config.ts', '--image-format=png', '--overwrite'],
  ['render', 'remotion/src/index.tsx', 'hero-loop', 'public/media/loops/hero.mp4', '--config=remotion/remotion.config.ts', '--codec=h264', '--pixel-format=yuv420p', '--video-bitrate=1M', '--color-space=bt709', '--image-format=png', '--muted', '--disallow-parallel-encoding', '--overwrite'],
  ['render', 'remotion/src/index.tsx', 'card-loop', 'public/media/loops/card.mp4', '--config=remotion/remotion.config.ts', '--codec=h264', '--pixel-format=yuv420p', '--video-bitrate=500K', '--color-space=bt709', '--image-format=png', '--muted', '--disallow-parallel-encoding', '--overwrite'],
];

const budgets = [
  ['public/og.png', 300_000],
  ['public/media/loops/hero.mp4', 1_500_000],
  ['public/media/loops/card.mp4', 800_000],
];

for (const [output] of budgets) mkdirSync(resolve(root, dirname(output)), { recursive: true });

for (const args of tasks) {
  const result = spawnSync(npx, ['remotion', ...args], {
    cwd: root,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

let videoTotal = 0;
for (const [output, ceiling] of budgets) {
  const bytes = statSync(resolve(root, output)).size;
  if (output.endsWith('.mp4')) videoTotal += bytes;
  console.log(`${output}: ${bytes} bytes (ceiling ${ceiling})`);
  if (bytes > ceiling) {
    console.error(`${output} exceeds its decimal byte ceiling by ${bytes - ceiling} bytes.`);
    process.exit(1);
  }
}

if (videoTotal > 8_000_000) {
  console.error(`Combined video size ${videoTotal} exceeds 8000000 bytes.`);
  process.exit(1);
}

console.log(`Combined video: ${videoTotal} bytes (ceiling 8000000)`);
