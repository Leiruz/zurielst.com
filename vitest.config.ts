import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  plugins: [
    {
      name: 'globals-css-contract-source',
      enforce: 'pre',
      resolveId(id) {
        return id === 'virtual:globals-css-source' ? '\0virtual:globals-css-source' : null;
      },
      load(id) {
        if (id !== '\0virtual:globals-css-source') return null;
        const stylesPath = fileURLToPath(new URL('./styles/globals.css', import.meta.url));
        return `export default ${JSON.stringify(readFileSync(stylesPath, 'utf8'))};`;
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    include: [
      'workers/chat-api/test/**/*.test.ts',
      'components/registry/**/*.test.ts',
      'components/registry/**/*.test.tsx',
      'content/**/*.test.ts',
      'lib/**/*.test.ts',
      'lib/**/*.test.tsx',
    ],
    poolOptions: {
      workers: {
        singleWorker: process.platform === 'win32',
        wrangler: { configPath: './workers/chat-api/wrangler.jsonc' },
      },
    },
  },
});
