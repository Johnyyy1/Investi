// Product funnel (#355) migration and persistence checks. Runs only in an explicitly disposable local database.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { buildFunnelReport, formatFunnelReport } from "../src/features/analytics/report";
import { loadFunnelFacts, recordEarlyReturn, recordLandingView } from "../src/features/analytics/repository";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Requires a disposable local DB.");
assert.equal(url.pathname, "/investi_funnel_qa");
assert.equal(process.env.FUNNEL_QA_DISPOSABLE, "1", "Explicit disposable QA opt-in required.");
const sql = postgres(url.toString(), { prepare: false, onnotice: () => {} });
const db = drizzle(sql);
const temp = await mkdtemp(join(tmpdir(), "investi-funnel-migrations-"));
const prefix = `funnelqa_${randomUUID()}`;
const [account, guest, demo, legacyDemo, fresh] = ["account", "guest", "demo", "legacy-demo", "fresh"].map((suffix) => `${prefix}_${suffix}`);
const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);
const views = async (day: string) => Number((await sql`select views from analytics_landing_view_day where day = ${day}`)[0]?.views ?? 0);

try {
  // 1. The migration is additive: rows written before it stay as they were, and a rerun changes nothing.
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  const prior = journal.entries.filter((entry: { tag: string }) => entry.tag !== "0018_product_funnel");
  await mkdir(join(temp, "meta"));
  await writeFile(join(temp, "meta/_journal.json"), JSON.stringify({ ...journal, entries: prior }));
  for (const entry of prior) await copyFile(`drizzle/${entry.tag}.sql`, join(temp, `${entry.tag}.sql`));
  await migrate(db, { migrationsFolder: temp });
  execFileSync("npm", ["run", "db:seed"], { stdio: "pipe", env: process.env });
  const user = (id: string, anonymous: boolean, kind: string | null, createdAt: Date) => sql`insert into "user" (id, name, email, is_anonymous, anonymous_kind, created_at, updated_at)
    values (${id}, 'Funnel QA', ${`${id}@example.com`}, ${anonymous}, ${kind}, ${createdAt.toISOString()}, ${createdAt.toISOString()})`;
  await user(account, false, null, daysAgo(3));
  const before = await sql`select * from "user" where id = ${account}`;
  await migrate(db, { migrationsFolder: "drizzle" });
  await migrate(db, { migrationsFolder: "drizzle" });
  assert.deepEqual(await sql`select * from "user" where id = ${account}`, before, "existing users are untouched");
  console.log("PASS: migration 0018 is additive and reruns cleanly.");

  // 2. Fixture learners: an account with every step, a guest with one lesson, demos with learning that must not count.
  await user(guest, true, "guest", daysAgo(2));
  await user(demo, true, "demo", daysAgo(2));
  await user(legacyDemo, true, null, daysAgo(2));
  await user(fresh, false, null, now);
  const lessonId = "foundations-why-invest";
  const awardAt = daysAgo(3).toISOString();
  await sql`insert into learning_profile (user_id, goals, daily_goal_minutes, time_zone, onboarding_step, diagnostic_result, personalized_onboarding_completed_at, onboarding_completed_at, updated_at)
    values (${account}, '{}', 10, 'Europe/Prague', 6, ${JSON.stringify({ version: "foundations-v1", answers: {}, evidence: {}, correctCount: 0, level: "foundations_needed" })}::jsonb, ${awardAt}, ${awardAt}, now())`;
  for (const id of [account, guest, demo, legacyDemo]) {
    await sql`insert into lesson_progress (user_id, lesson_id, status, last_position, completed_at, updated_at) values (${id}, ${lessonId}, 'completed', 3, ${awardAt}, ${awardAt})`;
    await sql`insert into lesson_award (user_id, lesson_id, xp, practice_capital_minor, reward_policy_version, learning_date, time_zone, awarded_at) values (${id}, ${lessonId}, 60, 0, 3, current_date, 'Europe/Prague', ${awardAt})`;
  }
  await sql`insert into lesson_progress (user_id, lesson_id, status, last_position, updated_at) values (${account}, 'foundations-stocks', 'in_progress', 1, now())`;
  await sql`insert into learner_artifact (id, user_id, kind, version, payload, source_lesson_id, request_id) values (${`${account}-a`}, ${account}, 'goal_map', 1, '{"goals":[]}', ${lessonId}, ${`${account}-r`})`;
  await sql`insert into portfolio (id, user_id, opened_at, opening_capital_minor) values (${`${account}-p`}, ${account}, now(), 500000)`;
  await sql`insert into portfolio_trade (id, portfolio_id, instrument_id, instrument_symbol, instrument_name, instrument_asset_type, side, quantity, unit_price, quote_currency, fx_rate_to_base,
    gross_amount_base_minor, fee_base_minor, cash_delta_base_minor, quote_observed_at, executed_at, market_data_provider, market_data_dataset, market_data_kind, market_data_is_deterministic, client_idempotency_key)
    values (${`${account}-t`}, ${`${account}-p`}, 'qa-etf', 'QAETF', 'QA World ETF', 'etf', 'BUY', '0.33333333', '101.25000000', 'EUR', '24.123456789012', 81419, 0, -81419, now(), now(), 'deterministic', 'qa', 'synthetic', true, ${`${account}-k`})`;

  // 3. Early returns: one row per learner, only on days 1–7, retries and races included.
  await Promise.all(Array.from({ length: 10 }, () => recordEarlyReturn(db, { id: account, createdAt: daysAgo(3) }, now)));
  await recordEarlyReturn(db, { id: account, createdAt: daysAgo(3) }, new Date(now.getTime() + 60_000));
  const returns = await sql`select returned_at from analytics_early_return where user_id = ${account}`;
  assert.equal(returns.length, 1, "one early return per learner");
  assert.equal(new Date(returns[0].returned_at).toISOString(), now.toISOString(), "the first return wins");
  await recordEarlyReturn(db, { id: fresh, createdAt: now }, now);
  await recordEarlyReturn(db, { id: guest, createdAt: daysAgo(10) }, now);
  assert.equal((await sql`select count(*)::int as count from analytics_early_return where user_id in (${fresh}, ${guest})`)[0].count, 0, "nothing on the start day or after day 7");
  console.log("PASS: early returns are recorded once, only on days 1–7 after the start.");

  // 4. Landing views: concurrent beacons all count, on the Prague calendar day.
  const day = "1999-01-02";
  const late = new Date("1999-01-01T23:30:00.000Z"); // 00:30 on 2 January in Prague
  await Promise.all(Array.from({ length: 25 }, () => recordLandingView(db, late)));
  assert.equal(await views(day), 25, "no lost updates");
  assert.equal(await views("1999-01-01"), 0, "the Prague day, not the UTC day");
  console.log("PASS: concurrent landing views are counted exactly, per Prague calendar day.");

  // 5. The report reads accounts and guests only, and prints counts only.
  const facts = await loadFunnelFacts(db);
  const mine = facts.learners.filter((learner) => learner.key.startsWith(prefix));
  assert.deepEqual(mine.map((learner) => learner.key).sort(), [account, fresh, guest].sort(), "demos, old and new, are not learners");
  const owner = mine.find((learner) => learner.key === account)!;
  assert.equal(owner.kind, "account");
  assert.ok(owner.diagnosticAt && owner.firstLessonAt && owner.firstArtifactAt && owner.firstLabTradeAt && owner.returnedAt, "every step is read");
  assert.equal(mine.find((learner) => learner.key === guest)!.kind, "guest");
  assert.equal(facts.progress.filter((row) => row.key.startsWith(prefix)).length, 3, "progress of accounts and guests only");
  assert.ok(facts.visits.some((row) => row.day === day && row.views === 25));
  const report = buildFunnelReport(facts, now);
  for (const output of [JSON.stringify(report), formatFunnelReport(report)]) assert.ok(!output.includes(prefix), "no learner key in the report");
  console.log("PASS: the report counts accounts and guests, excludes demos and never prints an identifier.");

  // 6. Deleting a user cascades the early return; landing views are not personal data and stay.
  await sql`delete from "user" where id = ${account}`;
  assert.equal((await sql`select count(*)::int as count from analytics_early_return where user_id = ${account}`)[0].count, 0);
  assert.equal(await views(day), 25);
  console.log("PASS: account deletion removes the early return and leaves the daily counts.");
} catch (error) {
  console.error(error); process.exitCode = 1;
} finally {
  await sql`delete from "user" where id like ${`${prefix}%`}`.catch(() => {});
  await sql`delete from analytics_landing_view_day where day < '2000-01-01'`.catch(() => {});
  await rm(temp, { recursive: true, force: true });
  await sql.end();
}
