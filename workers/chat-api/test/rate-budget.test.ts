import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import {
  DAILY_CAP,
  NEURONS_PER_CHAT_WORST,
  reserveDailyBudget,
  type BudgetReservation,
} from '../src/budget';
import { FixedWindowRateLimiter, checkRateLimit, type RateLimitBinding } from '../src/ratelimit';

describe('rate limiting', () => {
  it('denies the eleventh request for one IP in a fixed minute', async () => {
    const limiter = new FixedWindowRateLimiter(10, 60_000);
    const now = 1_800_000;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(checkRateLimit({}, '203.0.113.8', limiter, now)).resolves.toBe(true);
    }
    await expect(checkRateLimit({}, '203.0.113.8', limiter, now)).resolves.toBe(false);
    await expect(checkRateLimit({}, '203.0.113.9', limiter, now)).resolves.toBe(true);
    await expect(checkRateLimit({}, '203.0.113.8', limiter, now + 60_000)).resolves.toBe(true);
  });

  it('fails closed on platform denial or error', async () => {
    const denied: RateLimitBinding = { limit: async () => ({ success: false }) };
    const broken: RateLimitBinding = { limit: async () => { throw new Error('binding failure'); } };

    await expect(
      checkRateLimit({ RATE_LIMITER: denied }, '198.51.100.2', new FixedWindowRateLimiter(), 0),
    ).resolves.toBe(false);
    await expect(
      checkRateLimit({ RATE_LIMITER: broken }, '198.51.100.3', new FixedWindowRateLimiter(), 0),
    ).resolves.toBe(false);
  });

  it('evicts IP state from expired fixed windows', () => {
    const limiter = new FixedWindowRateLimiter(10, 60_000);
    const trackedWindows = () => (
      limiter as unknown as { windows: Map<string, unknown> }
    ).windows.size;

    expect(limiter.allow('192.0.2.1', 0)).toBe(true);
    expect(limiter.allow('192.0.2.2', 0)).toBe(true);
    expect(trackedWindows()).toBe(2);

    expect(limiter.allow('192.0.2.3', 60_000)).toBe(true);
    expect(trackedWindows()).toBe(1);
  });

  it('fails closed for unseen IPs when current-window state is full', () => {
    const limiter = new FixedWindowRateLimiter(10, 60_000, 2);
    const trackedWindows = () => (
      limiter as unknown as { windows: Map<string, unknown> }
    ).windows.size;

    expect(limiter.allow('192.0.2.1', 0)).toBe(true);
    expect(limiter.allow('192.0.2.2', 0)).toBe(true);
    expect(limiter.allow('192.0.2.1', 0)).toBe(true);
    expect(limiter.allow('192.0.2.3', 0)).toBe(false);
    expect(trackedWindows()).toBe(2);
  });
});

describe('daily Durable Object budget', () => {
  it('keeps the documented neuron budget within the free daily allocation', () => {
    expect(NEURONS_PER_CHAT_WORST).toBe(33.123038);
    expect(DAILY_CAP).toBeLessThanOrEqual(200);
    expect(DAILY_CAP * NEURONS_PER_CHAT_WORST).toBeLessThanOrEqual(4_000);
  });

  it('atomically allows exactly 120 of 501 concurrent reservations and persists the count', async () => {
    const stub = env.DAILY_BUDGET.get(env.DAILY_BUDGET.idFromName('2099-01-17'));
    const reservations = await Promise.all(
      Array.from({ length: 501 }, () => stub.reserve()),
    ) as BudgetReservation[];

    expect(reservations.filter(({ allowed }) => allowed)).toHaveLength(DAILY_CAP);
    expect(reservations.filter(({ allowed }) => !allowed)).toHaveLength(501 - DAILY_CAP);
    expect(reservations.at(-1)).toEqual({ allowed: false, remaining: 0 });

    const persisted = await runInDurableObject(stub, (_instance, state) => {
      const rows = [...state.storage.sql.exec<{ count: number }>('SELECT count FROM daily_budget WHERE singleton = 1')];
      return rows[0]?.count;
    });
    expect(persisted).toBe(DAILY_CAP);
  });

  it('fails closed when its storage table is unavailable', async () => {
    const stub = env.DAILY_BUDGET.get(env.DAILY_BUDGET.idFromName('2099-01-18'));
    await expect(stub.reserve()).resolves.toEqual({ allowed: true, remaining: DAILY_CAP - 1 });
    await runInDurableObject(stub, (_instance, state) => {
      state.storage.sql.exec('DROP TABLE daily_budget');
    });

    await expect(stub.reserve()).resolves.toEqual({ allowed: false, remaining: 0 });
  });

  it('addresses different UTC dates as fresh budget objects', async () => {
    const dateA = new Date('2099-02-03T23:59:59.999Z');
    const dateB = new Date('2099-02-04T00:00:00.000Z');
    const dateAReservations = await Promise.all(
      Array.from({ length: DAILY_CAP }, () => reserveDailyBudget(env, dateA)),
    );
    const exhaustedDateA = await reserveDailyBudget(env, dateA);
    const firstOnDateB = await reserveDailyBudget(env, dateB);

    expect(dateAReservations.every(({ allowed }) => allowed)).toBe(true);
    expect(exhaustedDateA).toEqual({ allowed: false, remaining: 0 });
    expect(firstOnDateB).toEqual({ allowed: true, remaining: DAILY_CAP - 1 });
  });
});
