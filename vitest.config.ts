import { fileURLToPath } from 'node:url';
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
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
    ],
    poolOptions: {
      workers: {
        wrangler: { configPath: './workers/chat-api/wrangler.jsonc' },
      },
    },
  },
});
