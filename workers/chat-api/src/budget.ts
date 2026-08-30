import { DurableObject } from 'cloudflare:workers';

import { MAX_OUTPUT_TOKENS } from './ai';
import { MAX_SERIALIZED_PROMPT_BYTES } from './prompt';

// Cloudflare pricing: 4,625 neurons per 1,000,000 input tokens. https://developers.cloudflare.com/workers-ai/platform/pricing/
export const LLAMA_3B_IN = 4_625;
// Cloudflare pricing: 30,475 neurons per 1,000,000 output tokens. https://developers.cloudflare.com/workers-ai/platform/pricing/
export const LLAMA_3B_OUT = 30_475;
// Cloudflare pricing: 2,457 neurons per 1,000,000 input tokens. https://developers.cloudflare.com/workers-ai/platform/pricing/
export const LLAMA_1B_IN = 2_457;
// Cloudflare pricing: 18,252 neurons per 1,000,000 output tokens. https://developers.cloudflare.com/workers-ai/platform/pricing/
export const LLAMA_1B_OUT = 18_252;

/**
 * The full JSON-serialized prompt is hard-capped in UTF-8 bytes. A byte-level
 * BPE token emits at least one byte, so that byte count safely upper-bounds
 * input tokens. This includes maximum output for the primary and fallback.
 */
export const NEURONS_PER_CHAT_WORST = (
  MAX_SERIALIZED_PROMPT_BYTES * LLAMA_3B_IN
  + MAX_OUTPUT_TOKENS * LLAMA_3B_OUT
  + MAX_SERIALIZED_PROMPT_BYTES * LLAMA_1B_IN
  + MAX_OUTPUT_TOKENS * LLAMA_1B_OUT
) / 1_000_000;

export const DAILY_CAP = Math.min(
  200,
  Math.floor(4_000 / NEURONS_PER_CHAT_WORST),
);

export interface BudgetReservation {
  allowed: boolean;
  remaining: number;
}

interface DailyBudgetEnv {
  DAILY_CAP: string;
}

export interface DailyBudgetNamespaceEnv {
  DAILY_BUDGET: DurableObjectNamespace<DailyBudget>;
}

function configuredCap(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, DAILY_CAP);
}

export class DailyBudget extends DurableObject<DailyBudgetEnv> {
  private readonly initialized: Promise<boolean>;

  constructor(ctx: DurableObjectState, env: DailyBudgetEnv) {
    super(ctx, env);
    this.initialized = Promise.resolve().then(() => {
      this.ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS daily_budget (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), count INTEGER NOT NULL)',
      );
      return true;
    }).catch(() => false);
  }

  async reserve(): Promise<BudgetReservation> {
    try {
      if (!await this.initialized) return { allowed: false, remaining: 0 };
      const cap = configuredCap(this.env.DAILY_CAP);
      if (cap === null) return { allowed: false, remaining: 0 };

      const cursor = this.ctx.storage.sql.exec<{ count: number }>(
        'INSERT INTO daily_budget (singleton, count) VALUES (1, 1) ON CONFLICT(singleton) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count',
        cap,
      );
      const row = [...cursor][0];
      if (row === undefined) return { allowed: false, remaining: 0 };
      return { allowed: true, remaining: Math.max(0, cap - row.count) };
    } catch {
      return { allowed: false, remaining: 0 };
    }
  }
}

export async function reserveDailyBudget(
  env: DailyBudgetNamespaceEnv,
  now = new Date(),
): Promise<BudgetReservation> {
  try {
    const date = now.toISOString().slice(0, 10);
    const id = env.DAILY_BUDGET.idFromName(date);
    return await env.DAILY_BUDGET.get(id).reserve();
  } catch {
    return { allowed: false, remaining: 0 };
  }
}
