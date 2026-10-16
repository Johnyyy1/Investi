import { describe, expect, it, vi } from "vitest";

import { RateLimiter, RequestRateLimitedError, type RateLimitCount, type RateLimitCounter, type RateLimitStore } from "./limiter";
import {
  authIpRules, marketDataBuckets, marketDataLimitMessage, MARKET_DATA_DAILY_RULE, MARKET_DATA_DAILY_SCOPE, marketDataMinuteRules,
  normalizeAccountSubject, retryAfterSeconds, splitBetterAuthKey, type RateLimitBucket,
} from "./policy";

const SECRET = "test-secret-test-secret-test-secret-0123";

/** Same fixed-window semantics as the Postgres store, in memory. */
class MemoryStore implements RateLimitStore {
  readonly rows = new Map<string, { count: number; expiresAt: number }>();
  async increment(counters: readonly RateLimitCounter[], now: number): Promise<RateLimitCount[]> {
    const unique = [...new Map(counters.map((counter) => [counter.key, counter])).values()];
    return unique.map(({ key, windowSeconds }) => {
      const row = this.rows.get(key);
      const next = !row || row.expiresAt <= now ? { count: 1, expiresAt: now + windowSeconds * 1_000 } : { count: row.count + 1, expiresAt: row.expiresAt };
      this.rows.set(key, next);
      return { key, ...next };
    });
  }
}

function setup(start = 1_000_000) {
  let now = start;
  const store = new MemoryStore();
  const onDenied = vi.fn();
  const limiter = new RateLimiter({ store, secret: SECRET, clock: () => now, onDenied });
  return { limiter, store, onDenied, advance: (ms: number) => { now += ms; } };
}

const bucket = (max: number, window = 60, subject = "user-1", scope = "test:scope"): RateLimitBucket => ({ scope, subject, rule: { window, max } });

describe("RateLimiter", () => {
  it("allows exactly max hits per window and reports the remaining wait", async () => {
    const { limiter, advance } = setup();
    for (let hit = 0; hit < 3; hit++) expect((await limiter.consume([bucket(3)])).allowed).toBe(true);
    advance(15_000);
    expect(await limiter.consume([bucket(3)])).toEqual({ allowed: false, retryAfterSeconds: 45, deniedScope: "test:scope" });
  });

  it("restarts the window once it has ended, even after hammering", async () => {
    const { limiter, advance } = setup();
    for (let hit = 0; hit < 50; hit++) await limiter.consume([bucket(2)]);
    advance(59_999);
    expect((await limiter.consume([bucket(2)])).allowed).toBe(false);
    advance(1);
    expect((await limiter.consume([bucket(2)])).allowed).toBe(true);
  });

  it("counts subjects and scopes independently", async () => {
    const { limiter } = setup();
    await limiter.consume([bucket(1, 60, "a")]);
    expect((await limiter.consume([bucket(1, 60, "b")])).allowed).toBe(true);
    expect((await limiter.consume([bucket(1, 60, "a", "other:scope")])).allowed).toBe(true);
    expect((await limiter.consume([bucket(1, 60, "a")])).allowed).toBe(false);
  });

  it("denies when any bucket is over and names the one with the longest wait", async () => {
    const { limiter } = setup();
    const minute = bucket(100, 60, "u", "market:search");
    const day = bucket(2, 86_400, "u", MARKET_DATA_DAILY_SCOPE);
    await limiter.consume([minute, day]);
    await limiter.consume([minute, day]);
    expect(await limiter.consume([minute, day])).toEqual({ allowed: false, retryAfterSeconds: 86_400, deniedScope: MARKET_DATA_DAILY_SCOPE });
  });

  it("logs only the first rejection of a window, without the subject", async () => {
    const { limiter, onDenied } = setup();
    for (let hit = 0; hit < 6; hit++) await limiter.consume([bucket(2, 60, "203.0.113.9")]);
    expect(onDenied).toHaveBeenCalledTimes(1);
    expect(onDenied).toHaveBeenCalledWith({ scope: "test:scope", retryAfterSeconds: 60 });
  });

  it("never stores a raw subject in the key", async () => {
    const { limiter, store } = setup();
    await limiter.consume([bucket(1, 60, "learner@example.com", "auth:sign-in-account")]);
    const [key] = store.rows.keys();
    expect(key).toMatch(/^auth:sign-in-account:[A-Za-z0-9_-]{43}$/);
    expect(key).not.toContain("learner");
    expect(new RateLimiter({ store, secret: `${SECRET}-rotated` }).keyFor("auth:sign-in-account", "learner@example.com")).not.toBe(key);
  });

  it("enforce throws a typed error carrying the decision", async () => {
    const { limiter } = setup();
    await limiter.enforce([bucket(1)]);
    await expect(limiter.enforce([bucket(1)])).rejects.toBeInstanceOf(RequestRateLimitedError);
  });

  it("allows an empty request without touching the store", async () => {
    const store = { increment: vi.fn() };
    expect(await new RateLimiter({ store, secret: SECRET }).consume([])).toMatchObject({ allowed: true });
    expect(store.increment).not.toHaveBeenCalled();
  });

  it("rejects a short secret", () => {
    expect(() => new RateLimiter({ store: new MemoryStore(), secret: "short" })).toThrow();
  });

  it("serves Better Auth's per-IP-and-path rules from the shared store", async () => {
    const { limiter, store } = setup();
    const storage = limiter.betterAuthStorage();
    const rule = authIpRules["/sign-in/email"];
    for (let hit = 0; hit < rule.max; hit++) expect(await storage.consume("198.51.100.4|/sign-in/email", rule)).toEqual({ allowed: true, retryAfter: null });
    expect(await storage.consume("198.51.100.4|/sign-in/email", rule)).toEqual({ allowed: false, retryAfter: 60 });
    expect(await storage.consume("198.51.100.5|/sign-in/email", rule)).toMatchObject({ allowed: true });
    expect([...store.rows.keys()].every((key) => key.startsWith("auth:/sign-in/email:") && !key.includes("198.51"))).toBe(true);
  });
});

describe("rate-limit policy", () => {
  it("is stricter than Better Auth's default 3 per 10 s for password and account endpoints", () => {
    for (const path of ["/sign-in/email", "/sign-up/email"] as const) expect(authIpRules[path].max / authIpRules[path].window).toBeLessThan(3 / 10);
  });

  it("gives every market-data read a per-user minute bucket and the shared daily budget", () => {
    for (const family of Object.keys(marketDataMinuteRules) as (keyof typeof marketDataMinuteRules)[]) {
      expect(marketDataBuckets("user-7", family)).toEqual([
        { scope: `market:${family}`, subject: "user-7", rule: marketDataMinuteRules[family] },
        { scope: MARKET_DATA_DAILY_SCOPE, subject: "user-7", rule: MARKET_DATA_DAILY_RULE },
      ]);
    }
  });

  it("normalizes account subjects and ignores non-strings", () => {
    expect(normalizeAccountSubject("  Learner@Example.COM ")).toBe("learner@example.com");
    expect(normalizeAccountSubject("")).toBeNull();
    expect(normalizeAccountSubject(42)).toBeNull();
    expect(normalizeAccountSubject("x".repeat(321))).toBeNull();
  });

  it("splits Better Auth keys at the first separator", () => {
    expect(splitBetterAuthKey("2001:0db8:0000:0000:0000:0000:0000:0000|/sign-in/email")).toEqual({ subject: "2001:0db8:0000:0000:0000:0000:0000:0000", path: "/sign-in/email" });
    expect(splitBetterAuthKey("no-trusted-ip|/a|b")).toEqual({ subject: "no-trusted-ip", path: "/a|b" });
    expect(splitBetterAuthKey("")).toEqual({ subject: "no-trusted-ip", path: "unknown" });
  });

  it("rounds retry hints up and never below one second", () => {
    expect(retryAfterSeconds(10_001, 0)).toBe(11);
    expect(retryAfterSeconds(5, 10)).toBe(1);
  });

  it("phrases market-data denials with a concrete wait", () => {
    expect(marketDataLimitMessage({ retryAfterSeconds: 42, deniedScope: "market:search" })).toBe("Tržní data načítáš příliš rychle. Zkus to znovu za 42 s.");
    expect(marketDataLimitMessage({ retryAfterSeconds: 61, deniedScope: "market:search" })).toBe("Tržní data načítáš příliš rychle. Zkus to znovu za 2 min.");
    expect(marketDataLimitMessage({ retryAfterSeconds: 5 * 3_600 + 1, deniedScope: MARKET_DATA_DAILY_SCOPE })).toBe("Denní limit tržních dat pro tvůj účet je vyčerpaný. Zkus to znovu za 6 h.");
  });
});
