// Removes anonymous (demo and guest) identities nobody can sign in to any more, using the same rule as the
// daily cron job (src/features/guest/cleanup.ts). Dry run by default; only DATABASE_URL is required.
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { countUnreachableAnonymousIdentities, deleteUnreachableAnonymousIdentities } from "../src/features/guest/cleanup";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required.");
const client = postgres(url, { prepare: false });
const database = drizzle({ client });
try {
  if (process.argv.includes("--apply")) {
    const { removed } = await deleteUnreachableAnonymousIdentities(database, { maxBatches: Number.POSITIVE_INFINITY });
    console.log(`Removed ${removed.demo} demo and ${removed.guest} guest identities and their cascading learning, portfolio and session data.`);
  } else {
    const eligible = await countUnreachableAnonymousIdentities(database);
    console.log(`${eligible.demo} demo and ${eligible.guest} guest identities have had no valid session for over a day. Run with --apply to remove them.`);
  }
} finally {
  await client.end();
}
