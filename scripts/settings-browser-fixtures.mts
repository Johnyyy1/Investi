import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const url = new URL(process.env.DATABASE_URL ?? "");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/investi_6a3a_qa");
assert.equal(process.env.PERSONALIZATION_QA_DISPOSABLE, "1");
assert.equal(process.env.MARKET_DATA_PROVIDER, "deterministic");
assert.equal(process.env.FX_DATA_PROVIDER, "deterministic");
const id = process.env.SETTINGS_QA_DEMO_ID;
assert.ok(id);
const sql = postgres(url.toString(), { prepare: false });
const [owner] = await sql`select is_anonymous from "user" where id=${id}`;
assert.equal(owner?.is_anonymous, true);
const { executeTrade } = await import("../src/features/portfolio/repository");
// A real authoritative fractional buy makes reset-history assertions non-vacuous.
await executeTrade(id, { instrumentId: "US-XNAS:AAPL", quantity: "0.1", side: "BUY", clientIdempotencyKey: randomUUID() });
await sql.end();
process.exit(0);
