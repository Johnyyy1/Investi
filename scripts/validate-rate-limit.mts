import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray, like } from "drizzle-orm";
import postgres from "postgres";
import { db } from "../src/db";
import * as schema from "../src/db/schema";
import { lesson, lessonAward, portfolioAllocation, portfolioTrade, rateLimitBucket, user } from "../src/db/schema";
import { auth } from "../src/lib/auth";
import { isMarketDataError } from "../src/features/market-data/errors";
import { portfolioMarketData } from "../src/features/portfolio/environment";
import { executeAllocation, executeTrade, getOrCreateActivePortfolio } from "../src/features/portfolio/repository";
import { enforceMarketDataBudget, rateLimiter } from "../src/features/rate-limit";
import { isRequestRateLimitedError, RateLimiter } from "../src/features/rate-limit/limiter";
import {
  authIpRules, DEMO_CREATION_IP_RULE, MARKET_DATA_DAILY_RULE, MARKET_DATA_DAILY_SCOPE, marketDataBuckets, marketDataMinuteRules, SIGN_IN_ACCOUNT_RULE,
} from "../src/features/rate-limit/policy";
import { PostgresRateLimitStore } from "../src/features/rate-limit/postgres-store";

/**
 * Shared rate limits on a disposable local database: two independent connection pools stand in for two
 * serverless instances. Counts are shared and exact under concurrency, windows restart, no raw subject is
 * stored, the real Better Auth handler enforces per-IP, per-account and demo-creation limits, and buy,
 * sell and save-mix spend the per-user market-data budget before any provider lookup.
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
const marketKeys = () => createdUsers.flatMap((id) => ["market:trade", "market:allocation", MARKET_DATA_DAILY_SCOPE].map((scope) => rateLimiter.keyFor(scope, id)));

async function createLearner(label: string) {
  const id = `${run}-${label}`;
  const at = new Date();
  await db.insert(user).values({ id, email: `${id}@example.com`, name: "Rate-limit QA", isAnonymous: false, createdAt: at, updatedAt: at });
  createdUsers.push(id);
  const lessonIds = (await db.select({ id: lesson.id }).from(lesson).where(eq(lesson.isPublished, true))).map((row) => row.id).slice(0, 2);
  assert.equal(lessonIds.length, 2, "seeded published lessons are required");
  await db.insert(lessonAward).values(lessonIds.map((lessonId, index) => ({
    userId: id, lessonId, xp: 60, practiceCapitalMinor: 200_000n, rewardPolicyVersion: 1, learningDate: `2026-09-0${index + 1}`, timeZone: "UTC", awardedAt: at,
  })));
  return id;
}
async function counted(scope: string, subject: string) {
  const [row] = await db.select({ count: rateLimitBucket.count }).from(rateLimitBucket).where(eq(rateLimitBucket.key, rateLimiter.keyFor(scope, subject)));
  return row?.count ?? 0;
}
// Every observation starts with instrument metadata. A failed lookup is not cached, so for an unknown id one call
// here is one provider request; a successful observation asks again for the quote, so mixes count distinct ids.
let metadataLookups = 0;
const lookedUp = new Set<string>();
const metadata = portfolioMarketData.service.getInstrumentMetadata.bind(portfolioMarketData.service);
portfolioMarketData.service.getInstrumentMetadata = (instrumentId) => { metadataLookups++; lookedUp.add(instrumentId); return metadata(instrumentId); };

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

  // 9. Buying an unknown instrument over and over stops reaching the provider at the trade budget.
  assert.equal(process.env.MARKET_DATA_PROVIDER ?? "deterministic", "deterministic", "The trade checks run against deterministic sample data.");
  const prober = await createLearner("prober");
  const chargeTrade = (subject: string) => (lookups: number) => enforceMarketDataBudget(subject, "trade", lookups);
  const tradeRule = marketDataMinuteRules.trade;
  const outcomes = [];
  metadataLookups = 0;
  for (let attempt = 0; attempt < tradeRule.max + 5; attempt++) {
    const error = await executeTrade(prober, { instrumentId: "US-XNAS:NOSUCH", quantity: "1", side: "BUY", clientIdempotencyKey: randomUUID() }, chargeTrade(prober)).then(() => null, (failure: unknown) => failure);
    outcomes.push(isRequestRateLimitedError(error) ? "limited" : isMarketDataError(error) && error.code === "InstrumentNotFound" ? "not-found" : String(error));
  }
  assert.deepEqual(outcomes, [...Array(tradeRule.max).fill("not-found"), ...Array(5).fill("limited")], "calls past the budget are refused before the lookup");
  assert.equal(metadataLookups, tradeRule.max, "provider lookups stop at the configured budget");
  assert.equal(await counted(MARKET_DATA_DAILY_SCOPE, prober), tradeRule.max + 5, "every attempt is charged to the daily budget");
  assert.equal((await instanceB.consume(marketDataBuckets(prober, "trade"))).allowed, false, "another instance sees the same trade budget");
  console.log("PASS: repeated buys of an unknown instrument stop reaching the provider at the shared trade budget.");

  // 10. A retried buy answered from the ledger is free; a mix is charged once per instrument it observes.
  const trader = await createLearner("trader");
  const generation = await getOrCreateActivePortfolio(trader);
  const buyKey = randomUUID();
  const buy = { instrumentId: "US-XNAS:AAPL", quantity: "1", side: "BUY" as const, clientIdempotencyKey: buyKey };
  assert.equal((await executeTrade(trader, buy, chargeTrade(trader))).duplicate, false);
  assert.equal((await executeTrade(trader, buy, chargeTrade(trader))).duplicate, true);
  assert.equal(await counted("market:trade", trader), 1, "the duplicate retry does not charge the trade budget");
  assert.equal(await counted(MARKET_DATA_DAILY_SCOPE, trader), 1, "the duplicate retry does not charge the daily budget");
  const chargeMix = (lookups: number) => enforceMarketDataBudget(trader, "allocation", lookups);
  const mix = { lines: [{ instrumentId: "IE-XETR:VWCE", weightBasisPoints: 4_000 }, { instrumentId: "US-XNAS:MSFT", weightBasisPoints: 5_000 }], cashWeightBasisPoints: 1_000 };
  const mixKey = randomUUID();
  lookedUp.clear();
  assert.equal((await executeAllocation(trader, { ...mix, clientIdempotencyKey: mixKey }, chargeMix)).duplicate, false);
  assert.deepEqual([...lookedUp].sort(), ["IE-XETR:VWCE", "US-XNAS:AAPL", "US-XNAS:MSFT"], "the mix observes both lines and the AAPL holding it sells");
  assert.equal(await counted("market:allocation", trader), 1, "the minute bucket counts the request");
  assert.equal(await counted(MARKET_DATA_DAILY_SCOPE, trader), 1 + 3, "the daily budget counts each observed instrument");
  assert.equal((await executeAllocation(trader, { ...mix, clientIdempotencyKey: mixKey }, chargeMix)).duplicate, true);
  assert.equal(await counted(MARKET_DATA_DAILY_SCOPE, trader), 1 + 3, "the duplicate mix does not charge again");
  console.log("PASS: duplicate retries are free and a mix spends one daily unit per observed instrument.");

  // 11. A mix that would overrun the daily budget is refused before any lookup and writes nothing.
  const tradesBefore = (await db.select().from(portfolioTrade).where(eq(portfolioTrade.portfolioId, generation.id))).length;
  await rateLimiter.consume([{ scope: MARKET_DATA_DAILY_SCOPE, subject: trader, rule: MARKET_DATA_DAILY_RULE, cost: MARKET_DATA_DAILY_RULE.max - 4 - 1 }]);
  metadataLookups = 0;
  const refused = await executeAllocation(trader, { lines: [{ instrumentId: "US-XNAS:AAPL", weightBasisPoints: 9_000 }], cashWeightBasisPoints: 1_000, clientIdempotencyKey: randomUUID() }, chargeMix).then(() => null, (failure: unknown) => failure);
  assert.ok(isRequestRateLimitedError(refused) && refused.decision.deniedScope === MARKET_DATA_DAILY_SCOPE, "the daily budget refuses a mix of three lookups with one unit left");
  assert.equal(metadataLookups, 0, "a refused mix observes nothing");
  assert.equal((await db.select().from(portfolioTrade).where(eq(portfolioTrade.portfolioId, generation.id))).length, tradesBefore, "a refused mix executes no trade");
  assert.equal((await db.select().from(portfolioAllocation).where(eq(portfolioAllocation.portfolioId, generation.id))).length, 1, "a refused mix stores no target");
  console.log("PASS: a mix over the daily budget is refused before any lookup and writes nothing.");
} finally {
  await db.delete(rateLimitBucket).where(inArray(rateLimitBucket.key, marketKeys()));
  if (createdUsers.length) await db.delete(user).where(inArray(user.id, createdUsers));
  await db.delete(rateLimitBucket).where(like(rateLimitBucket.key, `${run}:%`));
  await db.delete(rateLimitBucket).where(inArray(rateLimitBucket.key, authKeys()));
  await otherClient.end();
}
process.exit(0);
