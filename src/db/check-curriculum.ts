import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import { assertCurriculumComplete } from "./curriculum";

// Read-only: reports whether every catalog lesson can save progress, without writing anything.
const client = postgres(env.DATABASE_URL, { prepare: false });
const db = drizzle({ client });

assertCurriculumComplete(db)
  .then(({ modules, lessons }) => console.log(`db:check-curriculum: all ${lessons} published lessons across ${modules} modules are in the database.`))
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => client.end());
