import { createHmac } from "node:crypto";

import { retryAfterSeconds, splitBetterAuthKey, type RateLimitBucket, type RateLimitDecision, type RateLimitRule } from "./policy";

export interface RateLimitCounter {
  readonly key: string;
  readonly windowSeconds: number;
}

export interface RateLimitCount {
  readonly key: string;
  /** Hits in the current window including this one. */
  readonly count: number;
  readonly expiresAt: number;
}

/** Atomically adds one hit to every counter (restarting expired windows) and returns the new counts. */
export interface RateLimitStore {
  increment(counters: readonly RateLimitCounter[], now: number): Promise<RateLimitCount[]>;
}

export type RateLimitDenialLog = (event: { scope: string; retryAfterSeconds: number }) => void;

/** One structured line per subject and window; no IP, e-mail or user id is ever logged. */
export const logRateLimitDenial: RateLimitDenialLog = (event) => {
  console.warn(`[investi:rate-limit] ${JSON.stringify({ event: "denied", ...event })}`);
};

/** Thrown by application code when a request is over its budget; mapped to a friendly message at the boundary. */
export class RequestRateLimitedError extends Error {
  constructor(readonly decision: RateLimitDecision) {
    super("The request is over its rate limit.");
    this.name = "RequestRateLimitedError";
  }
}

export function isRequestRateLimitedError(error: unknown): error is RequestRateLimitedError {
  return error instanceof RequestRateLimitedError;
}

export interface RateLimiterOptions {
  store: RateLimitStore;
  /** Keys subjects so the shared table never stores a raw IP address, e-mail or user id. */
  secret: string;
  clock?: () => number;
  onDenied?: RateLimitDenialLog;
}

/**
 * Fixed-window limiter over a shared store. Every bucket of a request is counted in one atomic step,
 * and the request passes only if all of them are within their rule. Denied hits still count, so a
 * client hammering past its limit does not get a fresh allowance until the window ends.
 */
export class RateLimiter {
  private readonly store: RateLimitStore;
  private readonly secret: string;
  private readonly clock: () => number;
  private readonly onDenied: RateLimitDenialLog;

  constructor(options: RateLimiterOptions) {
    if (options.secret.length < 32) throw new Error("A rate-limit secret of at least 32 characters is required.");
    this.store = options.store;
    this.secret = options.secret;
    this.clock = options.clock ?? Date.now;
    this.onDenied = options.onDenied ?? logRateLimitDenial;
  }

  keyFor(scope: string, subject: string) {
    const digest = createHmac("sha256", this.secret).update(`${scope}\u0000${subject}`).digest("base64url");
    return `${scope.slice(0, 160)}:${digest}`;
  }

  async consume(buckets: readonly RateLimitBucket[]): Promise<RateLimitDecision> {
    if (buckets.length === 0) return { allowed: true, retryAfterSeconds: null, deniedScope: null };
    const now = this.clock();
    const keyed = buckets.map((bucket) => ({ ...bucket, key: this.keyFor(bucket.scope, bucket.subject) }));
    const counts = new Map((await this.store.increment(keyed.map(({ key, rule }) => ({ key, windowSeconds: rule.window })), now)).map((count) => [count.key, count]));
    let denied: { scope: string; retryAfterSeconds: number } | null = null;
    for (const bucket of keyed) {
      const count = counts.get(bucket.key);
      if (!count) throw new Error("The rate-limit store did not return a counter.");
      if (count.count <= bucket.rule.max) continue;
      const wait = retryAfterSeconds(count.expiresAt, now);
      // Log only the first rejection of each window so a hammering client cannot flood the logs.
      if (count.count === bucket.rule.max + 1) this.onDenied({ scope: bucket.scope, retryAfterSeconds: wait });
      if (!denied || wait > denied.retryAfterSeconds) denied = { scope: bucket.scope, retryAfterSeconds: wait };
    }
    return denied
      ? { allowed: false, retryAfterSeconds: denied.retryAfterSeconds, deniedScope: denied.scope }
      : { allowed: true, retryAfterSeconds: null, deniedScope: null };
  }

  /** Throws RequestRateLimitedError when any bucket is over its rule. */
  async enforce(buckets: readonly RateLimitBucket[]) {
    const decision = await this.consume(buckets);
    if (!decision.allowed) throw new RequestRateLimitedError(decision);
    return decision;
  }

  /** Better Auth `rateLimit.customStorage`: its per-IP-and-path rules, counted in the shared store. */
  betterAuthStorage() {
    return {
      consume: async (key: string, rule: RateLimitRule) => {
        const { subject, path } = splitBetterAuthKey(key);
        const decision = await this.consume([{ scope: `auth:${path}`, subject, rule }]);
        return { allowed: decision.allowed, retryAfter: decision.retryAfterSeconds };
      },
    };
  }
}
