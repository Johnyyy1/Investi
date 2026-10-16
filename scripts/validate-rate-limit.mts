import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { inArray, like } from "drizzle-orm";
import postgres from "postgres";
import { db } from "../src/db";
import * as schema from "../src/db/schema";
import { rateLimitBucket, user } from "../src/db/schema";
import { auth } from "../src/lib/auth";
import { rateLimiter } from "../src/features/rate-limit";
import { RateLimiter } from "../src/features/rate-limit/limiter";
import { authIpRules, DEMO_CREATION_IP_RULE, SIGN_IN_ACCOUNT_RULE } from "../src/features/rate-limit/policy";
import { PostgresRateLimitStore } from "../src/features/rate-limit/postgres-store";

/**
 * Shared rate limits on a disposable local database: two independent connection pools stand in for two
 * serverless instances. Counts are shared and exact under concurrency, windows restart, no raw subject is
 * stored, and the real Better Auth handler enforces per-IP, per-account and demo-creation limits.
 */
const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required.");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname), "Requires a local database.");
const secret = process.env.BETTER_AUTH_SECRET!;

const run = `rlqa-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const otherClient = postgres(databaseUrl, { prepare: false, max: 10 });
const otherDb = drizzle({ client: otherClient, schema });
const now = Date.now();
const instanceA = new RateLimiter({ store: new PostgresRateLimitStore(db), secret, clock: () => now, onDenied: () => {} });
const instanceB = new RateLimiter({ store: new PostgresRateLimitStore(otherDb), secret, clock: () => now, onDenied: () => {} });
const createdUsers: string[] = [];

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
async function post(path: string, ip: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await auth.handler(new Request(`${baseURL}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseURL, "x-forwarded-for": ip, ...headers },
    body: JSON.stringify(body),
  }));
  if (response.ok && path === "/sign-in/anonymous") createdUsers.push(((await response.clone().json()) as { user: { id: string } }).user.id);
  return response;
}
// A fresh /24 per run keeps reruns inside one hour independent of each other.
const net = `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
const ipFor = (index: number) => `${net}.${index}`;
const authKeys = () => [
  ...[10, ...Array.from({ length: SIGN_IN_ACCOUNT_RULE.max + 1 }, (_, attempt) => 20 + attempt)].map((index) => rateLimiter.keyFor("auth:/sign-in/email", ipFor(index))),
  ...[40, 41].flatMap((index) => [rateLimiter.keyFor("auth:/sign-in/anonymous", ipFor(index)), rateLimiter.keyFor("auth:demo-creation", ipFor(index))]),
  rateLimiter.keyFor("auth:sign-in-account", `${run}-target@example.com`),
  ...Array.from({ length: authIpRules["/sign-in/email"].max + 1 }, (_, attempt) => rateLimiter.keyFor("auth:sign-in-account", `${run}-${attempt < authIpRules["/sign-in/email"].max ? attempt : "x"}@example.com`)),
];

try {
  // 1. Two instances share one counter: alternating hits stop at the combined max.
  const shared = { scope: `${run}:shared`, subject: "learner-1", rule: { window: 60, max: 6 } };
  const alternating = [];
  for (let hit = 0; hit < 8; hit++) alternating.push((await (hit % 2 ? instanceB : instanceA).consume([shared])).allowed);
  assert.deepEqual(alternating, [true, true, true, true, true, true, false, false], "the limit holds across instances");
  console.log("PASS: two instances enforce one shared counter.");

  // 2. Concurrent hits from both instances are counted exactly once each.
  const burst = { scope: `${run}:burst`, subject: "learner-2", rule: { window: 60, max: 10 } };
  const decisions = await Promise.all(Array.from({ length: 60 }, (_, index) => (index % 2 ? instanceB : instanceA).consume([burst])));
  assert.equal(decisions.filter((decision) => decision.allowed).length, 10, "exactly max concurrent hits pass");
  const [burstRow] = await db.select().from(rateLimitBucket).where(inArray(rateLimitBucket.key, [instanceA.keyFor(burst.scope, burst.subject)]));
  assert.equal(burstRow.count, 60, "no concurrent increment is lost");
  console.log("PASS: 60 concurrent hits across instances admit exactly 10 and lose no increment.");

  // 3. Overlapping multi-bucket requests in opposite order neither deadlock nor lose counts.
  const left = { scope: `${run}:left`, subject: "s", rule: { window: 60, max: 1_000 } };
  const right = { scope: `${run}:right`, subject: "s", rule: { window: 60, max: 1_000 } };
  await Promise.all(Array.from({ length: 40 }, (_, index) => (index % 2 ? instanceB : instanceA).consume(index % 2 ? [left, right] : [right, left])));
  const overlapRows = await db.select().from(rateLimitBucket).where(inArray(rateLimitBucket.key, [instanceA.keyFor(left.scope, "s"), instanceA.keyFor(right.scope, "s")]));
  assert.deepEqual(overlapRows.map((row) => row.count), [40, 40], "both counters see every hit");
  console.log("PASS: overlapping multi-bucket requests are deadlock-free.");

  // 4. A window restarts after it ends; a cold-started instance sees the same state.
  let later = now;
  const coldStart = new RateLimiter({ store: new PostgresRateLimitStore(otherDb), secret, clock: () => later, onDenied: () => {} });
  later = now + 59_999;
  assert.equal((await coldStart.consume([shared])).allowed, false, "still denied inside the window on a fresh instance");
  later = now + 60_000;
  assert.equal((await coldStart.consume([shared])).allowed, true, "allowed again once the window ends");
  console.log("PASS: windows restart at their end and survive instance restarts.");

  // 5. Keys never contain the subject, and purge removes only expired rows.
  const stored = await db.select({ key: rateLimitBucket.key }).from(rateLimitBucket).where(like(rateLimitBucket.key, `${run}:%`));
  assert.ok(stored.length >= 4 && stored.every(({ key }) => !key.includes("learner")), "subjects are stored only as HMACs");
  await new PostgresRateLimitStore(db).purgeExpired(now + 60_000);
  const remaining = await db.select({ key: rateLimitBucket.key }).from(rateLimitBucket).where(like(rateLimitBucket.key, `${run}:%`));
  assert.deepEqual(remaining.map(({ key }) => key), [instanceA.keyFor(shared.scope, shared.subject)], "only the restarted window survives the purge");
  console.log("PASS: no raw subject is stored and purge removes only expired windows.");

  // 6. Better Auth: per-IP sign-in rule is shared — instance B sees what the auth handler counted.
  const signInIp = ipFor(10);
  const signInRule = authIpRules["/sign-in/email"];
  for (let attempt = 0; attempt < signInRule.max; attempt++) {
    const response = await post("/sign-in/email", signInIp, { email: `${run}-${attempt}@example.com`, password: "wrong-password-123" });
    assert.notEqual(response.status, 429, `attempt ${attempt + 1} is within the per-IP rule`);
  }
  const blocked = await post("/sign-in/email", signInIp, { email: `${run}-x@example.com`, password: "wrong-password-123" });
  assert.equal(blocked.status, 429, "the per-IP sign-in rule blocks the next attempt");
  assert.ok(Number(blocked.headers.get("x-retry-after")) > 0, "a retry hint is sent");
  const fromB = new RateLimiter({ store: new PostgresRateLimitStore(otherDb), secret }).betterAuthStorage();
  assert.equal((await fromB.consume(`${signInIp}|/sign-in/email`, signInRule)).allowed, false, "another instance sees the same per-IP counter");
  console.log("PASS: Better Auth's per-IP sign-in limit is enforced from the shared store.");

  // 7. Per-account guessing from many IPs is stopped even though no single IP is limited.
  const target = `${run}-target@example.com`;
  const statuses = [];
  for (let attempt = 0; attempt <= SIGN_IN_ACCOUNT_RULE.max; attempt++) statuses.push((await post("/sign-in/email", ipFor(20 + attempt), { email: attempt % 2 ? target.toUpperCase() : target, password: "wrong-password-123" })).status);
  assert.ok(statuses.slice(0, SIGN_IN_ACCOUNT_RULE.max).every((status) => status !== 429), "attempts within the account rule pass");
  assert.equal(statuses.at(-1), 429, "the account rule blocks distributed guessing, case-insensitively");
  console.log("PASS: password guessing against one account is limited across IPs.");

  // 8. Repeated demo creation from one IP stops at the hourly cap; guests from that IP are unaffected.
  const demoIp = ipFor(40);
  for (let hit = 0; hit < DEMO_CREATION_IP_RULE.max - 1; hit++) await rateLimiter.consume([{ scope: "auth:demo-creation", subject: demoIp, rule: DEMO_CREATION_IP_RULE }]);
  assert.equal((await post("/sign-in/anonymous", demoIp, {})).status, 200, "the last demo within the cap is created");
  const demoBlocked = await post("/sign-in/anonymous", demoIp, {});
  assert.equal(demoBlocked.status, 429, "the next demo from the same IP is refused");
  assert.equal((await post("/sign-in/anonymous", demoIp, {}, { "x-investi-anonymous-kind": "guest" })).status, 200, "a guest from the same IP still starts");
  assert.equal((await post("/sign-in/anonymous", ipFor(41), {})).status, 200, "a demo from another IP still starts");
  console.log("PASS: repeated demo creation from one IP is stopped; guests and other IPs are not.");
} finally {
  if (createdUsers.length) await db.delete(user).where(inArray(user.id, createdUsers));
  await db.delete(rateLimitBucket).where(like(rateLimitBucket.key, `${run}:%`));
  await db.delete(rateLimitBucket).where(inArray(rateLimitBucket.key, authKeys()));
  await otherClient.end();
}
process.exit(0);
