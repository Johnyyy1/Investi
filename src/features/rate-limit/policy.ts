/**
 * Rate-limit policy: which scopes exist, how large each window is and how a denial reads to a learner.
 * Pure and storage-free; the shared Postgres store enforces it atomically across instances.
 */

export interface RateLimitRule {
  /** Fixed window length in seconds. */
  readonly window: number;
  readonly max: number;
}

/** One counter to consume: a readable scope plus the subject it counts (IP, account or user). */
export interface RateLimitBucket {
  readonly scope: string;
  readonly subject: string;
  readonly rule: RateLimitRule;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Seconds until every denying bucket has restarted; null when allowed. */
  readonly retryAfterSeconds: number | null;
  /** Scope of the bucket that denied the request with the longest wait; null when allowed. */
  readonly deniedScope: string | null;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Better Auth per-IP rules (key `ip|path`). They replace Better Auth's defaults for these paths;
 * every other path keeps its built-in rule, now stored in the shared store too.
 */
export const authIpRules = {
  "/sign-in/email": { window: MINUTE, max: 10 },
  "/sign-up/email": { window: MINUTE, max: 5 },
  // Guests and demos both start here; the demo seed has its own hourly cap below.
  "/sign-in/anonymous": { window: MINUTE, max: 5 },
  // E-mailed links: a few retries for a typo, far too few to flood an inbox from one IP.
  "/request-password-reset": { window: MINUTE, max: 5 },
  "/send-verification-email": { window: MINUTE, max: 5 },
  // The 24-character reset token cannot be guessed; this only caps scripted attempts.
  "/reset-password": { window: MINUTE, max: 10 },
  "/change-password": { window: MINUTE, max: 5 },
} as const satisfies Record<string, RateLimitRule>;

/** Password guessing against one account, whichever IPs it comes from. */
export const SIGN_IN_ACCOUNT_RULE: RateLimitRule = { window: 15 * MINUTE, max: 10 };
/** Seeded demo identities (DB writes + an open Portfolio Lab) created from one IP. */
export const DEMO_CREATION_IP_RULE: RateLimitRule = { window: HOUR, max: 20 };
/** Password guesses through the account-deletion confirmation, per signed-in user. */
export const ACCOUNT_DELETION_USER_RULE: RateLimitRule = { window: 15 * MINUTE, max: 5 };
/** Password-reset and verification e-mails sent to one address, whichever IPs ask for them. */
export const EMAIL_LINK_ACCOUNT_RULE: RateLimitRule = { window: HOUR, max: 5 };
/** Current-password guesses through Settings › change password, per signed-in user. */
export const CHANGE_PASSWORD_USER_RULE: RateLimitRule = { window: 15 * MINUTE, max: 5 };
/** Full personal-data exports per user; each one reads every row the user owns. */
export const ACCOUNT_EXPORT_USER_RULE: RateLimitRule = { window: HOUR, max: 10 };

export type MarketDataFamily = "search" | "instrument-preview" | "allocation-quotes" | "instrument-detail" | "instrument-compare" | "backtest";

/** Per-user bursts per surface; a debounced search box stays far below these. */
export const marketDataMinuteRules: Readonly<Record<MarketDataFamily, RateLimitRule>> = {
  search: { window: MINUTE, max: 20 },
  "instrument-preview": { window: MINUTE, max: 30 },
  "allocation-quotes": { window: MINUTE, max: 10 },
  "instrument-detail": { window: MINUTE, max: 30 },
  "instrument-compare": { window: MINUTE, max: 30 },
  backtest: { window: MINUTE, max: 20 },
};
/** One daily budget per user across every market-data surface, so one account cannot drain the provider quota. */
export const MARKET_DATA_DAILY_RULE: RateLimitRule = { window: DAY, max: 600 };
export const MARKET_DATA_DAILY_SCOPE = "market:daily";

export function marketDataBuckets(userId: string, family: MarketDataFamily): RateLimitBucket[] {
  return [
    { scope: `market:${family}`, subject: userId, rule: marketDataMinuteRules[family] },
    { scope: MARKET_DATA_DAILY_SCOPE, subject: userId, rule: MARKET_DATA_DAILY_RULE },
  ];
}

/** Subject used when no trusted client IP exists, matching Better Auth's own shared fallback bucket. */
export const NO_TRUSTED_IP_SUBJECT = "no-trusted-ip";

/** Lower-cased, trimmed e-mail; null for anything that is not a plausible address string. */
export function normalizeAccountSubject(email: unknown) {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 && normalized.length <= 320 ? normalized : null;
}

/** Better Auth hands custom storage `${ip}|${path}`; IPs never contain "|", paths might. */
export function splitBetterAuthKey(key: string) {
  const separator = key.indexOf("|");
  if (separator <= 0) return { subject: key || NO_TRUSTED_IP_SUBJECT, path: "unknown" };
  return { subject: key.slice(0, separator), path: key.slice(separator + 1) || "unknown" };
}

/** Whole seconds until a window ends, never below one so clients always back off. */
export function retryAfterSeconds(expiresAt: number, now: number) {
  return Math.max(1, Math.ceil((expiresAt - now) / 1_000));
}

/** Czech learner-facing message for a denied market-data read. */
export function marketDataLimitMessage(decision: Pick<RateLimitDecision, "retryAfterSeconds" | "deniedScope">) {
  const seconds = decision.retryAfterSeconds ?? MINUTE;
  const wait = seconds < MINUTE ? `${seconds} s` : seconds < HOUR ? `${Math.ceil(seconds / MINUTE)} min` : `${Math.ceil(seconds / HOUR)} h`;
  if (decision.deniedScope === MARKET_DATA_DAILY_SCOPE) return `Denní limit tržních dat pro tvůj účet je vyčerpaný. Zkus to znovu za ${wait}.`;
  return `Tržní data načítáš příliš rychle. Zkus to znovu za ${wait}.`;
}
