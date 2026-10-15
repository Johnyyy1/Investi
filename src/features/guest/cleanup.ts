import "server-only";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { session, user } from "@/db/schema";

/**
 * Retention for anonymous (demo and guest) identities.
 *
 * An anonymous identity has no password and no provider account: once every session it had has expired,
 * nobody can sign back in to it, so its learning is unreachable. Better Auth extends a session's expiry
 * while it is used, so an identity's age says nothing about whether a learner is still on it; only its
 * sessions do. The grace period covers in-flight requests and clock skew around the expiry instant.
 *
 * Saved accounts are never touched. Deleting the user row cascades its sessions, profile, progress,
 * receipts, unlocks, portfolios and trades; shared instruments and market data do not reference users.
 */
export const ANONYMOUS_CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;
export const ANONYMOUS_CLEANUP_BATCH_SIZE = 500;
/** Bounds one scheduled run; whatever remains is picked up by the next run. */
export const ANONYMOUS_CLEANUP_MAX_BATCHES = 20;

type Database = Pick<PostgresJsDatabase<Record<string, unknown>>, "execute">;
export type AnonymousCleanupCounts = { demo: number; guest: number };
export type AnonymousCleanupResult = { removed: AnonymousCleanupCounts; complete: boolean };

/** Anonymous identities created before the cutoff that have no session valid after it. */
function unreachableBefore(cutoff: Date) {
  const at = sql`${cutoff.toISOString()}::timestamptz`;
  return sql`${user.isAnonymous} and ${user.createdAt} < ${at}
    and not exists (select 1 from ${session} where ${session.userId} = ${user.id} and ${session.expiresAt} > ${at})`;
}

/** Anonymous rows created before guests existed have no kind and are demos. */
const kind = sql`coalesce(${user.anonymousKind}, 'demo')`;

function tally(rows: Iterable<{ kind: string; count: number }>): AnonymousCleanupCounts {
  const counts = { demo: 0, guest: 0 };
  for (const row of rows) counts[row.kind === "guest" ? "guest" : "demo"] += Number(row.count);
  return counts;
}

const cutoffAt = (now: Date) => new Date(now.getTime() - ANONYMOUS_CLEANUP_GRACE_MS);

/** Dry run: how many identities the next cleanup would remove. */
export async function countUnreachableAnonymousIdentities(database: Database, now = new Date()) {
  return tally(await database.execute<{ kind: string; count: number }>(sql`
    select ${kind} as kind, count(*)::int as count from ${user} where ${unreachableBefore(cutoffAt(now))} group by 1`));
}

/**
 * Deletes unreachable anonymous identities in bounded batches, oldest first. Each batch is one statement
 * that locks its rows with SKIP LOCKED, so it never waits on, or races, a guest claim or a lesson completion
 * holding the same row lock; a skipped row is retried by the next run. Concurrent runs split the work.
 */
export async function deleteUnreachableAnonymousIdentities(database: Database, {
  now = new Date(), batchSize = ANONYMOUS_CLEANUP_BATCH_SIZE, maxBatches = ANONYMOUS_CLEANUP_MAX_BATCHES,
}: { now?: Date; batchSize?: number; maxBatches?: number } = {}): Promise<AnonymousCleanupResult> {
  const cutoff = cutoffAt(now);
  const removed = { demo: 0, guest: 0 };
  for (let batch = 0; batch < maxBatches; batch++) {
    const counts = tally(await database.execute<{ kind: string; count: number }>(sql`
      with doomed as (
        select ${user.id} as id, ${kind} as kind from ${user}
        where ${unreachableBefore(cutoff)}
        order by ${user.createdAt} limit ${batchSize}
        for update skip locked
      ), deleted as (
        delete from ${user} where ${user.id} in (select id from doomed) and ${user.isAnonymous} returning ${user.id} as id
      )
      select doomed.kind, count(*)::int as count from deleted join doomed using (id) group by doomed.kind`));
    removed.demo += counts.demo;
    removed.guest += counts.guest;
    if (counts.demo + counts.guest < batchSize) return { removed, complete: true };
  }
  return { removed, complete: false };
}
