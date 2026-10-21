import "dotenv/config";

import assert from "node:assert/strict";
import postgres from "postgres";
import { readFile } from "node:fs/promises";

const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required.");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname), "Requires local DB.");
const sql = postgres(databaseUrl, { prepare: false, max: 1 });
try {
  const columns = await sql`
    select table_name, column_name, data_type, numeric_precision, numeric_scale, is_nullable
    from information_schema.columns
    where table_schema = 'public' and table_name in ('portfolio', 'portfolio_trade')
    order by table_name, ordinal_position
  `;
  assert.equal(columns.filter(({ table_name }) => table_name === "portfolio").length, 8);
  assert.equal(columns.filter(({ table_name }) => table_name === "portfolio_trade").length, 36);
  for (const legacySafeColumn of ["fx_rate_provider", "fx_rate_dataset", "fx_rate_kind", "fx_rate_is_deterministic", "fx_reference_date", "fx_rate_retrieved_at", "fee_profile_id", "trade_fee_rate_bps", "trade_fee_min_minor", "trade_fee_max_minor", "trade_fee_currency", "fx_markup_bps", "fx_markup_base_minor", "reference_fx_rate_to_base", "reference_gross_amount_base_minor"]) {
    assert.equal(columns.find(({ column_name }) => column_name === legacySafeColumn)?.is_nullable, "YES", `${legacySafeColumn} is nullable for legacy trades`);
  }
  const numeric = Object.fromEntries(columns.filter(({ numeric_precision }) => numeric_precision !== null).map((row) => [row.column_name, row]));
  assert.deepEqual([numeric.quantity.numeric_precision, numeric.quantity.numeric_scale], [24, 8]);
  assert.deepEqual([numeric.unit_price.numeric_precision, numeric.unit_price.numeric_scale], [24, 8]);
  assert.deepEqual([numeric.fx_rate_to_base.numeric_precision, numeric.fx_rate_to_base.numeric_scale], [24, 12]);
  for (const money of ["opening_capital_minor", "gross_amount_base_minor", "fee_base_minor", "cash_delta_base_minor"]) {
    assert.equal(columns.find(({ column_name }) => column_name === money)?.data_type, "bigint", `${money} uses exact minor units`);
  }

  const indexes = await sql`select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename in ('portfolio', 'portfolio_trade')`;
  assert.match(indexes.find(({ indexname }) => indexname === "portfolio_one_active_per_user_idx")?.indexdef ?? "", /UNIQUE.+WHERE \(closed_at IS NULL\)/i);
  assert.ok(indexes.some(({ indexname }) => indexname === "portfolio_trade_idempotency_idx"));
  assert.ok(indexes.some(({ indexname }) => indexname === "portfolio_reset_idempotency_idx"));

  const checks = await sql`
    select conname from pg_constraint
    where conrelid in ('portfolio'::regclass, 'portfolio_trade'::regclass) and contype = 'c'
  `;
  const checkNames = checks.map(({ conname }) => conname);
  for (const expected of [
    "portfolio_base_currency_check", "portfolio_opening_capital_nonnegative_check", "portfolio_reset_not_self_check",
    "portfolio_trade_quantity_positive_check", "portfolio_trade_unit_price_positive_check", "portfolio_trade_fx_positive_check",
    "portfolio_trade_gross_positive_check", "portfolio_trade_fee_nonnegative_check", "portfolio_trade_cash_delta_check",
    "portfolio_trade_cost_audit_check", "portfolio_trade_fx_provenance_complete_check", "portfolio_trade_fx_kind_check",
  ]) assert.ok(checkNames.includes(expected), `${expected} exists`);

  const cascades = await sql`
    select conname, confdeltype from pg_constraint
    where conname in ('portfolio_user_id_user_id_fk', 'portfolio_trade_portfolio_id_portfolio_id_fk')
  `;
  assert.ok(cascades.every(({ confdeltype }) => confdeltype === "c"), "ownership deletes cascade to generations and trades");
  // Upgrade real legacy-shaped tables in a transaction-local temp schema. This never
  // changes the normal database or rewrites the historical ledger fixture.
  await sql.begin(async (tx) => {
    await tx`create temp table portfolio_trade (like public.portfolio_trade including all) on commit drop`;
    await tx`alter table pg_temp.portfolio_trade drop constraint portfolio_trade_cost_audit_check`;
    const auditColumns = ["fee_profile_id", "trade_fee_rate_bps", "trade_fee_min_minor", "trade_fee_max_minor", "trade_fee_currency", "fx_markup_bps", "fx_markup_base_minor", "reference_fx_rate_to_base", "reference_gross_amount_base_minor"];
    for (const column of auditColumns) await tx.unsafe(`alter table pg_temp.portfolio_trade drop column "${column}"`);
    await tx`create temp table learning_profile (like public.learning_profile including all) on commit drop`;
    await tx`alter table pg_temp.learning_profile drop column broker_fee_profile_id`;
    await tx`insert into pg_temp.portfolio_trade (id, portfolio_id, instrument_id, instrument_symbol, instrument_name, instrument_asset_type, side, quantity, unit_price, quote_currency, fx_rate_to_base, gross_amount_base_minor, fee_base_minor, cash_delta_base_minor, quote_observed_at, executed_at, market_data_provider, market_data_dataset, market_data_kind, market_data_is_deterministic, client_idempotency_key)
      values ('legacy', 'generation', 'A', 'A', 'Fixture', 'equity', 'BUY', '0.25', '0.1', 'CZK', '1', 3, 0, -3, now(), now(), 'sample', 'fixture', 'synthetic', true, 'legacy-key')`;
    const [before] = await tx`select to_jsonb(t) as row from pg_temp.portfolio_trade t`;
    const migration = await readFile(new URL("../drizzle/0016_portfolio_costs.sql", import.meta.url), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) await tx.unsafe(statement);
    const [after] = await tx`select to_jsonb(t) as row from pg_temp.portfolio_trade t`;
    for (const column of auditColumns) { assert.equal(after.row[column], null, `${column}: legacy audit is not invented`); delete after.row[column]; }
    assert.deepEqual(after.row, before.row, "migration preserves every original trade field byte-for-byte");
    await assert.rejects(() => tx.savepoint((nested) => nested`update pg_temp.portfolio_trade set fee_profile_id = 'incomplete' where id = 'legacy'`), /portfolio_trade_cost_audit_check/, "partial audit snapshots are refused");
  });
  console.log("PASS: portfolio migration exact types, precision, generation/idempotency indexes, checks, and ownership cascades.");
} finally {
  await sql.end();
}
