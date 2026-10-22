import "server-only";

import { DrizzleQueryError } from "drizzle-orm/errors";
import postgres from "postgres";
import { isMarketDataError } from "@/features/market-data/errors";

const EMAIL = /[^\s@"'<>(),;:]+@[^\s@"'<>(),;:]+\.[^\s@"'<>(),;:]+/g;
const MAX_MESSAGE = 300;

/**
 * Normalizes an error for a server log: name, code, message, the database constraint/table it hit,
 * market-data context and the cause chain. Nothing else is read, so request bodies, sessions and
 * driver details (Postgres `detail` carries row values) never reach the log; e-mail addresses in a
 * message are masked. Drizzle's own message embeds every SQL parameter, so only its cause is kept.
 */
export function describeError(error: unknown, depth = 0): Record<string, unknown> {
  if (!(error instanceof Error)) return { type: typeof error };
  const fields = error as Error & Record<string, unknown>;
  const query = error instanceof DrizzleQueryError;
  // Drizzle leaves its name as "Error"; postgres.js takes it from its class name, which the build minifies.
  const described: Record<string, unknown> = { name: query ? "DrizzleQueryError" : error instanceof postgres.PostgresError ? "PostgresError" : error.name };
  if (typeof fields.code === "string") described.code = fields.code;
  if (!query) described.message = error.message.replace(EMAIL, "[e-mail]").slice(0, MAX_MESSAGE);
  for (const [field, key] of [["constraint_name", "constraint"], ["table_name", "table"], ["column_name", "column"], ["reason", "reason"]] as const) {
    if (typeof fields[field] === "string") described[key] = fields[field];
  }
  if (typeof fields.digest === "string") described.digest = fields.digest;
  if (isMarketDataError(error)) described.context = error.context;
  if (error.cause !== undefined && depth < 2) described.cause = describeError(error.cause, depth + 1);
  return described;
}

/**
 * Logs one failure the caller did not expect as `[scope] operation failed`. Callers keep expected
 * refusals (invalid input, rate limits, domain rules such as insufficient cash) out of it and still
 * return their usual learner-facing message. Never pass inputs or user data: only the error is logged.
 */
export function logUnexpectedError(scope: string, operation: string, error: unknown) {
  console.error(`[${scope}] ${operation} failed`, { error: describeError(error) });
}
