import "server-only";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { session } from "@/db/schema";
import { ANONYMOUS_CLEANUP_GRACE_MS } from "@/features/guest/cleanup";

/**
 * Retention for session rows, which hold the IP address and user agent of every sign-in.
 *
 * An expired session can never be used again, so it is kept only as a short security trail and then
 * deleted. This covers saved accounts too, which the anonymous cleanup never touches. The retention
 * stays longer than the anonymous cleanup grace period: that cleanup reads recently expired sessions
 * to decide whether a guest is still reachable, and deleting older ones cannot change its answer.
 */
export const EXPIRED_SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const EXPIRED_SESSION_BATCH_SIZE = 1000;
/** Bounds one scheduled run; whatever remains is picked up by the next run. */
export const EXPIRED_SESSION_MAX_BATCHES = 20;

if (EXPIRED_SESSION_RETENTION_MS <= ANONYMOUS_CLEANUP_GRACE_MS) throw new Error("Expired sessions must outlive the anonymous cleanup grace period.");

type Database = Pick<PostgresJsDatabase<Record<string, unknown>>, "execute">;
export type ExpiredSessionCleanupResult = { removed: number; complete: boolean };

/** Deletes sessions that expired more than the retention period ago, in bounded batches that skip locked rows. */
export async function deleteExpiredSessions(database: Database, {
  now = new Date(), retentionMs = EXPIRED_SESSION_RETENTION_MS, batchSize = EXPIRED_SESSION_BATCH_SIZE, maxBatches = EXPIRED_SESSION_MAX_BATCHES,
}: { now?: Date; retentionMs?: number; batchSize?: number; maxBatches?: number } = {}): Promise<ExpiredSessionCleanupResult> {
  const cutoff = sql`${new Date(now.getTime() - retentionMs).toISOString()}::timestamptz`;
  let removed = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const [row] = await database.execute<{ count: number }>(sql`
      with doomed as (
        select ${session.id} as id from ${session} where ${session.expiresAt} < ${cutoff}
        limit ${batchSize} for update skip locked
      ), deleted as (
        delete from ${session} where ${session.id} in (select id from doomed) and ${session.expiresAt} < ${cutoff} returning 1
      )
      select count(*)::int as count from deleted`);
    const count = Number(row?.count ?? 0);
    removed += count;
    if (count < batchSize) return { removed, complete: true };
  }
  return { removed, complete: false };
}
