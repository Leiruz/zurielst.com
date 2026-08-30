import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    include: ['workers/chat-api/test/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './workers/chat-api/wrangler.jsonc' },
      },
    },
  },
});
