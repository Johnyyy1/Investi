// Account deletion, data export and session retention on a disposable local database, through the real
// Better Auth handler and export route: deletion removes everything the user owns and nothing of other
// users or shared data; passwords, fresh sign-ins and guest identities are enforced; the export is
// owner-only and free of secrets. The session retention is global, so this needs an explicit opt-in.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { auth } from "../src/lib/auth";
import { GET as exportData } from "../src/app/api/account/export/route";
import { db } from "../src/db";
import { rateLimiter } from "../src/features/rate-limit";
import { deleteExpiredSessions, EXPIRED_SESSION_RETENTION_MS } from "../src/features/account/session-retention";
import { saveLearnerArtifact } from "../src/features/artifacts/repository";
import { artifactExamples } from "../src/features/artifacts/test-fixtures";
import { GUEST_KIND_HEADER } from "../src/features/guest/identity";

const url = process.env.DATABASE_URL;
assert.ok(url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname), "Requires a disposable local DB.");
assert.equal(process.env.ACCOUNT_DATA_QA_DISPOSABLE, "1", "Set ACCOUNT_DATA_QA_DISPOSABLE=1: the session retention deletes every old expired session in this database.");
const sql = postgres(url, { prepare: false });

const DAY = 24 * 60 * 60 * 1000;
const run = `acctqa${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const password = "correct-horse-battery-staple";
const net = `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
let ipIndex = 1;
const created: string[] = [];

async function call(path: string, { cookie, body, headers = {}, method = "POST" }: { cookie?: string; body?: unknown; headers?: Record<string, string>; method?: string } = {}) {
  return auth.handler(new Request(`${baseURL}/api/auth${path}`, {
    method,
    headers: { "content-type": "application/json", origin: baseURL, "x-forwarded-for": `${net}.${ipIndex++}`, ...(cookie ? { cookie } : {}), ...headers },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  }));
}
const cookieOf = (response: Response) => response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");

async function signUp(label: string) {
  const email = `${run}-${label}@example.com`;
  const response = await call("/sign-up/email", { body: { name: `QA ${label}`, email, password } });
  assert.equal(response.status, 200, `sign-up ${label}`);
  const { user } = await response.json() as { user: { id: string } };
  created.push(user.id);
  return { id: user.id, email, cookie: cookieOf(response) };
}

/** Learning, rewards and two portfolio generations with trades and a target mix. */
async function withEverything(userId: string, lessonIds: string[]) {
  for (let version = 0; version < 2; version++) await saveLearnerArtifact(userId, { content: { kind: "goal_map", payload: artifactExamples.goal_map }, sourceLessonId: lessonIds[0], consent: true, requestId: randomUUID() });
  for (const lessonId of lessonIds) {
    await sql`insert into lesson_progress (user_id, lesson_id, status, last_position, completed_at, updated_at) values (${userId}, ${lessonId}, 'completed', 3, now(), now())`;
    await sql`insert into lesson_award (user_id, lesson_id, xp, practice_capital_minor, reward_policy_version, learning_date, time_zone, awarded_at)
      values (${userId}, ${lessonId}, 60, 200000, 3, current_date, 'Europe/Prague', now())`;
  }
  await sql`insert into learning_profile (user_id, goals, daily_goal_minutes, time_zone, onboarding_step, onboarding_completed_at, updated_at) values (${userId}, '{QUANT}', 10, 'Europe/Prague', 6, now(), now())`;
  await sql`insert into progression_unlock (user_id, unlock_id, practice_capital_minor, reason, unlocked_at) values (${userId}, 'PORTFOLIO_LAB', 500000, 'qa', now())`;
  const closed = `${userId}-p1`, active = `${userId}-p2`;
  await sql`insert into portfolio (id, user_id, opened_at, closed_at, opening_capital_minor) values (${closed}, ${userId}, now() - interval '2 days', now() - interval '1 day', 500000)`;
  await sql`insert into portfolio (id, user_id, opened_at, reset_from_portfolio_id, opening_capital_minor) values (${active}, ${userId}, now(), ${closed}, 700000)`;
  for (const [index, portfolioId] of [closed, active].entries()) {
    await sql`insert into portfolio_trade (id, portfolio_id, instrument_id, instrument_symbol, instrument_name, instrument_asset_type, side, quantity, unit_price, quote_currency, fx_rate_to_base,
      gross_amount_base_minor, fee_base_minor, cash_delta_base_minor, quote_observed_at, executed_at, market_data_provider, market_data_dataset, market_data_kind, market_data_is_deterministic, client_idempotency_key)
      values (${`${portfolioId}-t`}, ${portfolioId}, 'qa-etf', 'QAETF', 'QA World ETF', 'etf', 'BUY', '0.33333333', '101.25000000', 'EUR', '24.123456789012',
      ${81419 + index}, 0, ${-(81419 + index)}, now(), now(), 'deterministic', 'qa', 'synthetic', true, ${`${portfolioId}-k`})`;
  }
  await sql`insert into portfolio_allocation (id, portfolio_id, created_at, cash_weight_basis_points, applied_value_minor, client_idempotency_key) values (${`${active}-a`}, ${active}, now(), 1000, 700000, ${`${active}-ak`})`;
  await sql`insert into portfolio_allocation_line (allocation_id, position, instrument_id, instrument_symbol, instrument_name, instrument_asset_type, quote_currency, weight_basis_points)
    values (${`${active}-a`}, 0, 'qa-etf', 'QAETF', 'QA World ETF', 'etf', 'EUR', 9000)`;
}

/** Every row the user owns, per table, including rows only reachable through their portfolios. */
async function owned(userId: string) {
  const [row] = await sql`select
    (select count(*) from "user" where id = ${userId})::int as "user",
    (select count(*) from session where user_id = ${userId})::int as sessions,
    (select count(*) from account where user_id = ${userId})::int as accounts,
    (select count(*) from learner_artifact where user_id = ${userId})::int as artifacts,
    (select count(*) from learning_profile where user_id = ${userId})::int as profile,
    (select count(*) from lesson_progress where user_id = ${userId})::int as progress,
    (select count(*) from lesson_award where user_id = ${userId})::int as awards,
    (select count(*) from progression_unlock where user_id = ${userId})::int as unlocks,
    (select count(*) from portfolio where id like ${`${userId}-%`})::int as portfolios,
    (select count(*) from portfolio_trade where portfolio_id like ${`${userId}-%`})::int as trades,
    (select count(*) from portfolio_allocation where portfolio_id like ${`${userId}-%`})::int as allocations,
    (select count(*) from portfolio_allocation_line where allocation_id like ${`${userId}-%`})::int as lines`;
  return { ...row };
}
const shared = async () => ({ ...(await sql`select
  (select count(*) from learning_module)::int as modules, (select count(*) from lesson)::int as lessons,
  (select count(*) from market_data_cache where cache_key = ${run})::int as cache,
  (select count(*) from rate_limit_bucket where key = ${run})::int as buckets`)[0] });
async function refusal(response: Response) {
  return { status: response.status, code: ((await response.json()) as { code?: string }).code };
}
const exportFor = (cookie?: string) => exportData(new Request(`${baseURL}/api/account/export`, { headers: cookie ? { cookie } : {} }));

try {
  const lessons = (await sql`select id from lesson where is_published order by id limit 2`).map((row) => row.id as string);
  assert.equal(lessons.length, 2, "Run db:migrate and db:seed first.");
  await sql`insert into market_data_cache (family, cache_key, format_version, value, stored_at, expires_at) values ('instrument', ${run}, 1, '{}', now(), now() + interval '1 hour')`;
  await sql`insert into rate_limit_bucket (key, count, window_started_at, expires_at) values (${run}, 1, now(), now() + interval '1 hour')`;

  const target = await signUp("target");
  const other = await signUp("other");
  await withEverything(target.id, lessons);
  await withEverything(other.id, lessons);
  const full = { user: 1, sessions: 1, accounts: 1, artifacts: 2, profile: 1, progress: 2, awards: 2, unlocks: 1, portfolios: 2, trades: 2, allocations: 1, lines: 1 };
  assert.deepEqual(await owned(target.id), full);
  const otherBefore = await owned(other.id);
  const sharedBefore = await shared();

  // 1. The export is owner-only, complete and free of secrets.
  assert.equal((await exportFor()).status, 401, "no session, no export");
  const exported = await exportFor(target.cookie);
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get("content-disposition") ?? "", /^attachment; filename="investi-moje-data-/);
  const text = await exported.text();
  const data = JSON.parse(text);
  assert.equal(data.user.email, target.email);
  assert.equal(data.learnerArtifacts.length, 2, "all artifact revisions are exported");
  assert.equal(data.portfolios.length, 2);
  assert.equal(data.portfolios.flatMap((generation: { trades: unknown[] }) => generation.trades).length, 2);
  assert.equal(data.portfolios[1].targetMixes[0].lines[0].weightBasisPoints, 9000);
  assert.equal(data.lessonRewardReceipts[0].practiceCapitalMinor, "200000", "minor units stay exact strings");
  assert.equal(data.portfolios[0].trades[0].fxRateToBase, "24.123456789012", "decimals stay exact strings");
  assert.equal(data.sessions[0].ipAddress, `${net}.1`, "session IP addresses are part of the export");
  assert.ok(!text.includes(other.email) && !text.includes(other.id), "nothing of another user");
  for (const secret of ["password", "accessToken", "refreshToken", "idToken", "\"token\""]) assert.ok(!text.includes(secret), `no ${secret}`);
  console.log("PASS: the export holds the owner's profile, sessions, learning, receipts and portfolios with exact amounts, nothing of others and no secrets.");

  // 2. Deletion of a password account needs the right password; refusals change nothing.
  assert.deepEqual(await refusal(await call("/delete-user", { cookie: target.cookie })), { status: 400, code: "PASSWORD_REQUIRED" });
  assert.deepEqual(await refusal(await call("/delete-user", { cookie: target.cookie, body: { password: "wrong-password-123" } })), { status: 400, code: "INVALID_PASSWORD" });
  assert.deepEqual(await refusal(await call("/delete-user", { cookie: target.cookie, body: { password, token: "x" } })), { status: 400, code: "DELETION_TOKEN_UNSUPPORTED" });
  assert.equal((await call("/delete-user", { body: { password } })).status, 401, "no session, no deletion");
  assert.deepEqual(await owned(target.id), full, "refused deletions leave everything in place");
  console.log("PASS: a password account is deleted only with its correct password; refusals change nothing.");

  // 3. A social-only account needs a sign-in from the last few minutes.
  const social = await signUp("social");
  await sql`delete from account where user_id = ${social.id}`;
  await sql`insert into account (id, account_id, provider_id, user_id, created_at, updated_at) values (${randomUUID()}, ${`google-${run}`}, 'google', ${social.id}, now(), now())`;
  await sql`update session set created_at = now() - interval '1 hour' where user_id = ${social.id}`;
  assert.deepEqual(await refusal(await call("/delete-user", { cookie: social.cookie })), { status: 400, code: "SESSION_NOT_FRESH" });
  await sql`update session set created_at = now() - interval '1 minute' where user_id = ${social.id}`;
  assert.equal((await call("/delete-user", { cookie: social.cookie })).status, 200);
  assert.equal((await owned(social.id)).user, 0);
  console.log("PASS: a social-only account is deleted only right after signing in.");

  // 4. Guests have no account to delete; the anonymous cleanup removes them.
  const guestResponse = await call("/sign-in/anonymous", { headers: { [GUEST_KIND_HEADER]: "guest" } });
  assert.equal(guestResponse.status, 200);
  const guest = ((await guestResponse.json()) as { user: { id: string } }).user.id;
  created.push(guest);
  assert.deepEqual(await refusal(await call("/delete-user", { cookie: cookieOf(guestResponse) })), { status: 403, code: "ANONYMOUS_IDENTITY" });
  console.log("PASS: guest identities cannot use account deletion.");

  // 5. Deletion removes everything the user owns, nothing of others, nothing shared, and ends the session.
  const deleted = await call("/delete-user", { cookie: target.cookie, body: { password } });
  assert.equal(deleted.status, 200);
  assert.ok(deleted.headers.getSetCookie().some((value) => value.startsWith("better-auth.session_token=;") || /better-auth\.session_token=[^;]*;.*Max-Age=0/i.test(value)), "the session cookie is cleared");
  assert.deepEqual(await owned(target.id), Object.fromEntries(Object.keys(full).map((key) => [key, 0])), "every owned row is gone");
  assert.deepEqual(await owned(other.id), otherBefore, "another user keeps everything");
  assert.deepEqual(await shared(), sharedBefore, "curriculum, market-data cache and rate-limit rows are untouched");
  assert.equal((await exportFor(target.cookie)).status, 401, "the old cookie no longer exports anything");
  assert.equal((await call("/delete-user", { cookie: target.cookie, body: { password } })).status, 401, "a retry finds no session");
  console.log("PASS: deletion cascades through sessions, accounts, profile, progress, receipts, unlocks, portfolios, trades and mixes; other users and shared data stay.");

  // 6. Session retention: only sessions expired longer ago than the retention period go, for any identity.
  await deleteExpiredSessions(db, { maxBatches: Number.POSITIVE_INFINITY });
  const sessionAt = async (userId: string, expiresIn: number) => {
    const id = randomUUID();
    await sql`insert into session (id, token, user_id, expires_at, created_at, updated_at, ip_address) values (${id}, ${randomUUID()}, ${userId}, ${new Date(Date.now() + expiresIn).toISOString()}, now() - interval '60 days', now(), '198.51.100.9')`;
    return id;
  };
  const old = [await sessionAt(other.id, -EXPIRED_SESSION_RETENTION_MS - DAY), await sessionAt(guest, -EXPIRED_SESSION_RETENTION_MS - 2 * DAY)];
  const kept = [await sessionAt(other.id, -EXPIRED_SESSION_RETENTION_MS + DAY), await sessionAt(other.id, -DAY), await sessionAt(other.id, DAY)];
  const locked = await sessionAt(other.id, -EXPIRED_SESSION_RETENTION_MS - 3 * DAY);
  let release!: () => void, holding!: () => void;
  const held = new Promise<void>((resolve) => { holding = resolve; });
  const lockHolder = sql.begin(async (tx) => {
    await tx`select id from session where id = ${locked} for update`;
    holding();
    await new Promise<void>((resolve) => { release = resolve; });
  });
  await held;
  assert.deepEqual(await deleteExpiredSessions(db, { batchSize: 1 }), { removed: 2, complete: true });
  release();
  await lockHolder;
  const inserted: string[] = [...old, ...kept, locked];
  const remaining = new Set((await sql`select id from session where id in ${sql(inserted)}`).map((row) => row.id as string));
  assert.deepEqual([...remaining].sort(), [...kept, locked].sort(), "old expired sessions go, recent and active ones stay, a locked one is skipped");
  assert.equal((await owned(guest)).user, 1, "the retention never deletes identities");
  assert.deepEqual(await deleteExpiredSessions(db), { removed: 1, complete: true }, "the skipped row goes on the next run");
  assert.deepEqual(await deleteExpiredSessions(db), { removed: 0, complete: true }, "reruns are idempotent");
  console.log("PASS: sessions expired over 30 days ago are deleted in batches for every identity; recent, active and locked sessions stay.");
} catch (error) {
  console.error(error); process.exitCode = 1;
} finally {
  if (created.length > 0) {
    await sql`delete from "user" where id in ${sql(created)}`;
    await sql`delete from rate_limit_bucket where key in ${sql(created.map((id) => rateLimiter.keyFor("auth:delete-account", id)))}`;
  }
  await sql`delete from market_data_cache where cache_key = ${run}`;
  await sql`delete from rate_limit_bucket where key = ${run}`;
  await sql.end();
  process.exit(process.exitCode ?? 0);
}
