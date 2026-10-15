import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sql as q } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/** Compatibility probe for named prepared statements through Drizzle + postgres.js, for a
 * DISPOSABLE database or pooler endpoint (e.g. a throwaway Neon branch's `-pooler` URL).
 * The app runs with `prepare: false` (docs/performance-baseline.md, Phase 4); this is the check that
 * has to pass on the real pooler before that changes. It uses its own temporary table and drops it.
 *
 *   PREPARED_TEST_DATABASE_URL=… PREPARED_TEST_CONFIRM_DISPOSABLE=1 npm run test:prepared-statements
 *
 * Never prints the URL, credentials or row data. Refuses the app's own DATABASE_URL endpoint. */
const url = process.env.PREPARED_TEST_DATABASE_URL;
assert.ok(url, "PREPARED_TEST_DATABASE_URL is required (a disposable database or Neon branch).");
assert.equal(process.env.PREPARED_TEST_CONFIRM_DISPOSABLE, "1", "Set PREPARED_TEST_CONFIRM_DISPOSABLE=1 to confirm the target is disposable.");
const target = new URL(url);
const local = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
if (process.env.DATABASE_URL && !local(target.hostname)) {
  const app = new URL(process.env.DATABASE_URL);
  assert.ok(app.hostname.replace("-pooler", "") !== target.hostname.replace("-pooler", ""), "Refusing the endpoint of DATABASE_URL: use a separate disposable branch.");
}
console.log(`target: ${local(target.hostname) ? "local" : "remote"}, pooled hostname: ${target.hostname.includes("-pooler") ? "yes" : "no"}`);

// The candidate under test: Drizzle sends every statement through `sql.unsafe`, which postgres.js
// does not prepare unless asked per call, so `postgres(url, { prepare: true })` alone changes nothing.
type Sql = postgres.Sql | postgres.TransactionSql;
function preparedStatements<T extends Sql>(sql: T): T {
  return new Proxy(sql, {
    get(target, property, receiver) {
      if (property === "unsafe") return (query: string, parameters?: postgres.ParameterOrJSON<never>[], options?: postgres.UnsafeQueryOptions) => target.unsafe(query, parameters, { prepare: true, ...options });
      if (property === "begin" || property === "savepoint") {
        return (...args: unknown[]) => {
          const callback = args.pop() as (tx: postgres.TransactionSql) => unknown;
          return (Reflect.get(target, property) as (...a: unknown[]) => unknown)(...args, (tx: postgres.TransactionSql) => callback(preparedStatements(tx)));
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}
const open = (options: postgres.Options<Record<string, postgres.PostgresType>> = {}) => {
  const client = postgres(url, { max: 10, onnotice: () => {}, ...options });
  return { client, db: drizzle({ client: preparedStatements(client) }) };
};
const table = q.identifier(`prepared_probe_${randomUUID().replaceAll("-", "").slice(0, 12)}`);
const setup = open({ max: 1 });
const failures: string[] = [];
const check = async (name: string, fn: () => Promise<string | void>) => {
  try { console.log(`ok   ${name}${await fn().then((d) => (d ? ` (${d})` : ""))}`); } catch (error) {
    failures.push(name);
    const e = error as { message?: string; cause?: { message?: string; code?: string } };
    console.log(`FAIL ${name}: ${(e.cause?.message ?? e.message ?? String(error)).slice(0, 200)}${e.cause?.code ? ` [${e.cause.code}]` : ""}`);
  }
};
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
const time = async (fn: () => Promise<unknown>) => { const t = performance.now(); await fn(); return performance.now() - t; };

await setup.db.execute(q`create table ${table} (id serial primary key, owner text not null, amount_minor bigint not null, price numeric(20, 8), day date, at timestamptz, flag boolean, tags text[], meta jsonb, note text)`);
try {
  await check("round trips: a repeated parameterised statement costs about one simple query", async () => {
    const { client, db } = open({ max: 1 });
    try {
      await db.execute(q`select 1`);
      const simples = []; for (let i = 0; i < 9; i++) simples.push(await time(() => db.execute(q`select 1`)));
      const simple = median(simples);
      const first = await time(() => db.execute(q`select count(*) from ${table} where owner = ${"first"}`));
      const repeats = []; for (let i = 0; i < 9; i++) repeats.push(await time(() => db.execute(q`select count(*) from ${table} where owner = ${`r${i}`}`)));
      const ratio = median(repeats) / simple;
      // Only meaningful with real network latency; locally every query is sub-millisecond.
      if (simple >= 2) assert.ok(ratio < 1.6, `repeated statement took ${ratio.toFixed(2)}× a simple query; prepared statements are not being reused`);
      return `simple ${simple.toFixed(1)} ms, first ${first.toFixed(1)} ms, repeated ${median(repeats).toFixed(1)} ms`;
    } finally { await client.end(); }
  });

  await check("parameter types round-trip exactly (bigint beyond 2^53, numeric, date, timestamptz, boolean, null, text[], jsonb)", async () => {
    const { client, db } = open({ max: 1 });
    try {
      const values = { amount: 9_007_199_254_740_993n, price: "1.33330000", day: "2026-01-31", at: "2026-01-31T12:34:56.789Z", tags: ["a", "b"], meta: { k: 0.1 } };
      for (let i = 0; i < 3; i++) await db.execute(q`insert into ${table} (owner, amount_minor, price, day, at, flag, tags, meta, note) values (${"types"}, ${values.amount}, ${values.price}, ${values.day}, ${values.at}, ${i % 2 === 0}, ${q.param(values.tags)}::text[], ${JSON.stringify(values.meta)}::jsonb, ${i === 1 ? null : "x"})`);
      const rows = await db.execute<{ amount: string; price: string; day: string; at: string; tags: string[]; meta: unknown; nulls: string }>(q`select sum(amount_minor)::text as amount, min(price)::text as price, min(day)::text as day, to_char(min(at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as at, min(tags) as tags, min(meta::text) as meta, count(*) filter (where note is null)::text as nulls from ${table} where owner = ${"types"}`);
      const [row] = rows;
      assert.equal(BigInt(row.amount), values.amount * 3n);
      assert.deepEqual([row.price, row.day, row.at, row.tags, JSON.parse(String(row.meta)), row.nulls], [values.price, values.day, values.at, values.tags, values.meta, "1"]);
    } finally { await client.end(); }
  });

  await check("concurrency: 4 pools × 10 connections, reads, FOR UPDATE transactions, savepoints, rollbacks; exact bigint total", async () => {
    const pools = [open(), open(), open(), open()];
    const stop = Date.now() + Number(process.env.PREPARED_TEST_SECONDS ?? 15) * 1000;
    let committed = 0n; let ops = 0; const errors = new Map<string, number>();
    await setup.db.execute(q`insert into ${table} (owner, amount_minor) select 'lock-' || g, 0 from generate_series(0, 7) g`);
    await Promise.all(Array.from({ length: 40 }, async (_, worker) => {
      const { db } = pools[worker % pools.length];
      while (Date.now() < stop) {
        const owner = `lock-${Math.floor(Math.random() * 8)}`; const kind = Math.floor(Math.random() * 4);
        try {
          if (kind === 0) await db.execute(q`select amount_minor from ${table} where owner = ${owner} limit 1`);
          else if (kind === 1) {
            await db.transaction(async (tx) => {
              await tx.execute(q`select id from ${table} where owner = ${owner} and amount_minor = ${0n} for update`);
              await tx.execute(q`insert into ${table} (owner, amount_minor) values (${`${owner}-ledger`}, ${9_007_199_254_740_993n})`);
              await tx.transaction(async (sp) => { await sp.execute(q`select count(*) from ${table} where owner = ${`${owner}-ledger`}`); });
            });
            committed += 9_007_199_254_740_993n;
          } else if (kind === 2) {
            await db.transaction(async (tx) => { await tx.execute(q`insert into ${table} (owner, amount_minor) values (${`${owner}-ledger`}, ${1n})`); tx.rollback(); }).catch((error) => { if (!String(error?.message).includes("Rollback")) throw error; });
          } else await db.execute(q`select count(*) from ${table} where owner in (${owner}, ${"none"})`);
          ops++;
        } catch (error) {
          const e = error as { message?: string; cause?: { message?: string } };
          const key = (e.cause?.message ?? e.message ?? String(error)).replace(/lock-\d/g, "lock-n").slice(0, 120);
          errors.set(key, (errors.get(key) ?? 0) + 1);
        }
      }
    }));
    await Promise.all(pools.map(({ client }) => client.end()));
    const [{ total }] = await setup.db.execute<{ total: string }>(q`select coalesce(sum(amount_minor), 0)::text as total from ${table} where owner like 'lock-%-ledger'`);
    assert.deepEqual(Object.fromEntries(errors), {}, "no errors");
    assert.equal(BigInt(total), committed, "committed total is exact; rolled-back inserts are absent");
    return `${ops} operations`;
  });

  await check("connection recycling: statements keep working across client reconnects (max_lifetime 1 s)", async () => {
    const { client, db } = open({ max: 2, max_lifetime: 1 });
    try {
      const stop = Date.now() + 4000; let n = 0;
      while (Date.now() < stop) { await db.execute(q`select count(*) from ${table} where owner = ${`cycle-${n % 3}`}`); n++; await new Promise((r) => setTimeout(r, 50)); }
      return `${n} queries`;
    } finally { await client.end(); }
  });

  await check("process restart: a new client reuses identical statement text without name clashes", async () => {
    for (let round = 0; round < 3; round++) {
      const { client, db } = open({ max: 3 });
      await Promise.all(Array.from({ length: 12 }, (_, i) => db.execute(q`select count(*) from ${table} where owner = ${`restart-${i}`}`)));
      await client.end();
    }
  });

  // Informational: what a migration that changes a selected column's type does to cached plans.
  // Through PgBouncer the server-side statement is shared by query text, so postgres.js's one
  // re-prepare retry can hit the same stale plan ("cached plan must not change result type").
  await check("schema change: errors after ALTER COLUMN TYPE on a selected column (reported, not asserted)", async () => {
    const pools = [open(), open()];
    const read = (db: (typeof pools)[number]["db"]) => db.execute(q`select note, amount_minor from ${table} where owner = ${"types"} limit 1`);
    for (const { db } of pools) await Promise.all(Array.from({ length: 10 }, () => read(db)));
    await setup.db.execute(q`alter table ${table} alter column note type varchar(200)`);
    const errors: number[] = [];
    for (let second = 0; second < 5; second++) {
      let failed = 0;
      for (const { db } of pools) await Promise.all(Array.from({ length: 20 }, () => read(db).catch(() => { failed++; })));
      errors.push(failed);
      await new Promise((r) => setTimeout(r, 1000));
    }
    await Promise.all(pools.map(({ client }) => client.end()));
    const fresh = open({ max: 4 }); let freshFailed = 0;
    await Promise.all(Array.from({ length: 20 }, () => read(fresh.db).catch(() => { freshFailed++; })));
    await fresh.client.end();
    return `failed reads per second after the change: ${errors.join(", ")} of 40; a brand-new client afterwards: ${freshFailed} of 20`;
  });
} finally {
  await setup.db.execute(q`drop table if exists ${table}`);
  await setup.client.end();
}
if (failures.length) { console.log(`\n${failures.length} check(s) failed`); process.exit(1); }
console.log("\nall checks passed");
