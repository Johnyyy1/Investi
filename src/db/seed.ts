import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import { assertCurriculumComplete, seedCurriculum } from "./curriculum";

const client = postgres(env.DATABASE_URL, { prepare: false });
const db = drizzle({ client });

async function seed() {
  await seedCurriculum(db);
  const { modules, lessons } = await assertCurriculumComplete(db);
  console.log(`db:seed: curriculum has ${lessons} published lessons across ${modules} modules.`);
  await client.end();
}

seed().catch(async (error) => { console.error(error); await client.end(); process.exitCode = 1; });
