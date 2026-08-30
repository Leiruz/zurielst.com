import type { DailyBudget } from '../src/budget';

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DAILY_BUDGET: DurableObjectNamespace<DailyBudget>;
    DAILY_CAP: string;
  }
}
