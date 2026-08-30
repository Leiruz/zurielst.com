export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RateLimitEnv {
  RATE_LIMITER?: RateLimitBinding;
}

interface FixedWindow {
  startedAt: number;
  count: number;
}

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, FixedWindow>();

  constructor(
    private readonly limit = 10,
    private readonly windowMs = 60_000,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const current = this.windows.get(key);
    if (current === undefined || current.startedAt !== windowStart) {
      this.windows.set(key, { startedAt: windowStart, count: 1 });
      return true;
    }
    if (current.count >= this.limit) return false;
    current.count += 1;
    return true;
  }
}

export const isolateRateLimiter = new FixedWindowRateLimiter();

export async function checkRateLimit(
  env: RateLimitEnv,
  key: string,
  local = isolateRateLimiter,
  now = Date.now(),
): Promise<boolean> {
  if (!local.allow(key, now)) return false;
  if (env.RATE_LIMITER === undefined) return true;

  try {
    const result = await env.RATE_LIMITER.limit({ key });
    return result.success === true;
  } catch {
    return false;
  }
}
