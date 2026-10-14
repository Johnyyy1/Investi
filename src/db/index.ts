import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import { perfEnabled, recordQuery } from "@/lib/perf";
import * as schema from "./schema";

const globalForDatabase = globalThis as unknown as { client?: ReturnType<typeof postgres> };
const client = globalForDatabase.client ?? postgres(env.DATABASE_URL, { prepare: false });

if (process.env.NODE_ENV !== "production") globalForDatabase.client = client;

export const db = drizzle({ client, schema, ...(perfEnabled ? { logger: { logQuery: (query: string) => recordQuery(query) } } : {}) });
