import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import { perfEnabled, recordConnection, recordQuery } from "@/lib/perf";
import * as schema from "./schema";

const globalForDatabase = globalThis as unknown as { client?: ReturnType<typeof postgres> };
// postgres.js asks for the password once per new connection, so a function password lets perf count them (same fallback as postgres.js).
const countingPassword = () => { recordConnection(); return decodeURIComponent(new URL(env.DATABASE_URL).password) || process.env.PGPASSWORD || ""; };
const client = globalForDatabase.client ?? postgres(env.DATABASE_URL, { prepare: false, ...(perfEnabled ? { password: countingPassword } : {}) });

if (process.env.NODE_ENV !== "production") globalForDatabase.client = client;

export const db = drizzle({ client, schema, ...(perfEnabled ? { logger: { logQuery: (query: string) => recordQuery(query) } } : {}) });
