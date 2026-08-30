import type { DailyBudget } from '../src/budget';
import type { AiBinding } from '../src/ai';

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    AI: AiBinding;
    DAILY_BUDGET: DurableObjectNamespace<DailyBudget>;
    DAILY_CAP: string;
    ALLOWED_HOSTS: string;
  }
}
