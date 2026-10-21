import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required.");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname), "Requires local DB.");

const legacyRewardMigration = await readFile(new URL("../drizzle/0004_awesome_sebastian_shaw.sql", import.meta.url), "utf8");
const xpOnlyRewardMigration = await readFile(new URL("../drizzle/0008_overconfident_shape.sql", import.meta.url), "utf8");
const statements = (migration: string) => migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
const sql = postgres(databaseUrl, { prepare: false, max: 1 });

function schemaName(label: string) {
  return `practice_capital_${label}_${randomUUID().replaceAll("-", "")}`;
}

async function runInSchema(
  label: string,
  run: (tx: postgres.TransactionSql) => Promise<void>,
) {
  const schema = schemaName(label);
  await sql.unsafe(`CREATE SCHEMA "${schema}"`);
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO "${schema}", public`);
      await run(tx);
    });
  } finally {
    await sql.unsafe(`DROP SCHEMA "${schema}" CASCADE`);
  }
}

async function createLegacySchema(tx: postgres.TransactionSql) {
  await tx.unsafe(`
    CREATE TYPE progress_status AS ENUM ('not_started', 'in_progress', 'completed');
    CREATE TABLE lesson (
      id text PRIMARY KEY,
      is_published boolean NOT NULL
    );
    CREATE TABLE lesson_progress (
      user_id text NOT NULL,
      lesson_id text NOT NULL,
      status progress_status NOT NULL,
      completed_at timestamp with time zone,
      updated_at timestamp with time zone NOT NULL,
      PRIMARY KEY (user_id, lesson_id)
    );
    CREATE TABLE lesson_award (
      user_id text NOT NULL,
      lesson_id text NOT NULL,
      xp integer NOT NULL,
      learning_date date NOT NULL,
      time_zone text NOT NULL,
      awarded_at timestamp with time zone NOT NULL,
      PRIMARY KEY (user_id, lesson_id),
      CONSTRAINT lesson_award_xp_check CHECK (xp = 60)
    );
  `);
}

async function applyMigration(tx: postgres.TransactionSql, migration = legacyRewardMigration) {
  for (const statement of statements(migration)) await tx.unsafe(statement);
}

async function receiptSnapshot(tx: postgres.TransactionSql) {
  return tx.unsafe(`
    SELECT user_id, lesson_id, xp, practice_capital_minor::text, reward_policy_version,
      learning_date::text, time_zone, awarded_at::text
    FROM lesson_award
    ORDER BY user_id, lesson_id
  `);
}

try {
  await runInSchema("legacy", async (tx) => {
    await createLegacySchema(tx);
    await tx.unsafe(`
      INSERT INTO lesson VALUES
        ('rewarded', true),
        ('missing-receipt', true),
        ('incomplete', true),
        ('unpublished', false);
      INSERT INTO lesson_progress VALUES
        ('learner', 'rewarded', 'completed', '2026-09-08T10:00:00Z', '2026-09-08T10:00:00Z'),
        ('learner', 'missing-receipt', 'completed', '2026-09-10T00:30:00+02:00', '2026-09-10T00:30:00+02:00'),
        ('learner', 'incomplete', 'in_progress', NULL, '2026-09-10T10:00:00Z'),
        ('learner', 'unpublished', 'completed', '2026-09-10T10:00:00Z', '2026-09-10T10:00:00Z');
      INSERT INTO lesson_award VALUES
        ('learner', 'rewarded', 60, '2026-09-08', 'Europe/Prague', '2026-09-08T10:00:00Z');
    `);

    await applyMigration(tx);
    const first = await receiptSnapshot(tx);
    assert.deepEqual(first.map((row) => row.lesson_id), ["missing-receipt", "rewarded"]);
    assert.ok(first.every((row) => row.practice_capital_minor === "200000" && row.reward_policy_version === 1));
    const reconciled = first.find((row) => row.lesson_id === "missing-receipt");
    assert.equal(reconciled?.learning_date, "2026-09-09");
    assert.equal(reconciled?.time_zone, "UTC");

    await applyMigration(tx);
    assert.deepEqual(await receiptSnapshot(tx), first, "rerunning the migration must not change receipts");
  });

  await runInSchema("partial", async (tx) => {
    await createLegacySchema(tx);
    await tx.unsafe(`
      INSERT INTO lesson VALUES ('one', true), ('two', true);
      INSERT INTO lesson_award VALUES
        ('learner', 'one', 60, '2026-09-08', 'UTC', '2026-09-08T10:00:00Z'),
        ('learner', 'two', 60, '2026-09-09', 'UTC', '2026-09-09T10:00:00Z');
      ALTER TABLE lesson_award ADD COLUMN practice_capital_minor bigint;
      ALTER TABLE lesson_award ADD COLUMN reward_policy_version integer;
      UPDATE lesson_award SET practice_capital_minor = 200000, reward_policy_version = 1
      WHERE lesson_id = 'one';
    `);

    await applyMigration(tx);
    const receipts = await receiptSnapshot(tx);
    assert.equal(receipts.length, 2);
    assert.ok(receipts.every((row) => row.practice_capital_minor === "200000" && row.reward_policy_version === 1));
    const columns = await tx.unsafe(`
      SELECT attname, attnotnull
      FROM pg_attribute
      WHERE attrelid = 'lesson_award'::regclass
        AND attname IN ('practice_capital_minor', 'reward_policy_version')
      ORDER BY attname
    `);
    assert.ok(columns.every((column) => column.attnotnull));
    await assert.rejects(() => tx.savepoint(async (savepoint) => {
      await savepoint.unsafe(`UPDATE lesson_award SET practice_capital_minor = 0 WHERE lesson_id = 'one'`);
    }));
    await assert.rejects(() => tx.savepoint(async (savepoint) => {
      await savepoint.unsafe(`UPDATE lesson_award SET reward_policy_version = 0 WHERE lesson_id = 'one'`);
    }));
  });

  await runInSchema("xp_only", async (tx) => {
    await createLegacySchema(tx);
    await tx.unsafe(`
      INSERT INTO lesson VALUES ('legacy', true), ('current', true);
      INSERT INTO lesson_award VALUES
        ('learner', 'legacy', 60, '2026-09-08', 'Europe/Prague', '2026-09-08T10:00:00Z');
    `);
    await applyMigration(tx);

    const before = await receiptSnapshot(tx);
    assert.equal(before[0]?.practice_capital_minor, "200000");
    assert.equal(before[0]?.reward_policy_version, 1);

    await applyMigration(tx, xpOnlyRewardMigration);
    assert.deepEqual(await receiptSnapshot(tx), before, "policy v2 migration must not rewrite historical receipts");

    await tx.unsafe(`
      INSERT INTO lesson_award (
        user_id, lesson_id, xp, practice_capital_minor, reward_policy_version,
        learning_date, time_zone, awarded_at
      ) VALUES (
        'learner', 'current', 60, 0, 2,
        '2026-09-24', 'Europe/Prague', '2026-09-24T10:00:00Z'
      )
    `);
    const after = await receiptSnapshot(tx);
    assert.deepEqual(
      after.map((row) => [row.lesson_id, row.practice_capital_minor, row.reward_policy_version]),
      [["current", "0", 2], ["legacy", "200000", 1]],
    );
    await assert.rejects(() => tx.savepoint(async (savepoint) => {
      await savepoint.unsafe(`UPDATE lesson_award SET practice_capital_minor = -1 WHERE lesson_id = 'current'`);
    }));
  });

  await runInSchema("v4", async (tx) => {
    await createLegacySchema(tx);
    await tx.unsafe(`
      INSERT INTO lesson VALUES ('v1', true), ('v2', true), ('v3-behavior', true), ('v4-behavior', true), ('v4-analytical', true);
      INSERT INTO lesson_award VALUES ('learner', 'v1', 60, '2026-09-08', 'Europe/Prague', '2026-09-08T10:00:00Z');
    `);
    await applyMigration(tx);
    await applyMigration(tx, xpOnlyRewardMigration);
    const before = await receiptSnapshot(tx);
    await tx.unsafe(`
      INSERT INTO lesson_award (user_id, lesson_id, xp, practice_capital_minor, reward_policy_version, learning_date, time_zone, awarded_at)
      VALUES
        ('learner', 'v2', 60, 0, 2, '2026-09-24', 'Europe/Prague', '2026-09-24T10:00:00Z'),
        ('learner', 'v3-behavior', 60, 200000, 3, '2026-10-14', 'Europe/Prague', '2026-10-14T10:00:00Z'),
        ('learner', 'v4-behavior', 60, 0, 4, '2026-10-21', 'Europe/Prague', '2026-10-21T10:00:00Z'),
        ('learner', 'v4-analytical', 60, 200000, 4, '2026-10-21', 'Europe/Prague', '2026-10-21T10:00:00Z')
      ON CONFLICT (user_id, lesson_id) DO NOTHING;
    `);
    const after = await receiptSnapshot(tx);
    assert.deepEqual(after.filter((row) => row.reward_policy_version === 1), [...before]);
    assert.deepEqual(after.map((row) => [row.lesson_id, row.practice_capital_minor, row.reward_policy_version]), [
      ['v1', '200000', 1], ['v2', '0', 2], ['v3-behavior', '200000', 3], ['v4-analytical', '200000', 4], ['v4-behavior', '0', 4],
    ]);
    const [total] = await tx`select sum(practice_capital_minor)::text as minor from lesson_award`;
    assert.equal(total.minor, '600000', 'all versions coexist under the existing schema; no migration or repricing is needed');
    await tx.unsafe(`INSERT INTO lesson_award SELECT * FROM lesson_award ON CONFLICT (user_id, lesson_id) DO NOTHING`);
    assert.deepEqual(await receiptSnapshot(tx), after, 'retries preserve every field of every receipt');
  });

  console.log("PASS: Practice Capital migrations preserve v1/v2/v3/v4 receipts, accept XP-only receipts, reject negatives, and handle reconciliation, partial backfill, and retries.");
} finally {
  await sql.end();
}
