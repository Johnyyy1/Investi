// Internal product funnel towards milestone A (#355): the last 7 and 30 days, weekly cohorts and where
// learners stop, lesson by lesson. Read-only; prints aggregate counts, never anything about one person.
// Only DATABASE_URL is required. `--json` prints the same report as JSON, `--weeks=N` sets the cohort count.
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { buildFunnelReport, formatFunnelReport } from "../src/features/analytics/report";
import { loadFunnelFacts } from "../src/features/analytics/repository";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required.");
const weeksArgument = process.argv.find((argument) => argument.startsWith("--weeks="));
const weeks = weeksArgument ? Number(weeksArgument.slice("--weeks=".length)) : 8;
if (!Number.isInteger(weeks) || weeks < 1 || weeks > 104) throw new Error("--weeks must be a whole number from 1 to 104.");

const client = postgres(url, { prepare: false });
try {
  const report = buildFunnelReport(await loadFunnelFacts(drizzle({ client })), new Date(), { weeks });
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatFunnelReport(report));
} finally {
  await client.end();
}
