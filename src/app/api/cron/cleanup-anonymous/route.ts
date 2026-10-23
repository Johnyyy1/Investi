import { db } from "@/db";
import { deleteExpiredSessions } from "@/features/account/session-retention";
import { deleteUnreachableAnonymousIdentities } from "@/features/guest/cleanup";
import { PostgresMarketDataCacheStore } from "@/features/market-data/postgres-cache";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { env } from "@/lib/env";

/**
 * Daily Vercel Cron job (vercel.json): removes anonymous identities nobody can sign in to any more, then
 * session rows (with their IP address and user agent) that expired longer ago than the retention period, and
 * expired market-data cache rows (reads already ignore them; the purge only bounds the table).
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await deleteUnreachableAnonymousIdentities(db);
    console.info(`anonymous cleanup: removed ${result.removed.demo} demo and ${result.removed.guest} guest identities${result.complete ? "" : "; more remain for the next run"}`);
    const expiredSessions = await deleteExpiredSessions(db);
    console.info(`session retention: removed ${expiredSessions.removed} expired sessions${expiredSessions.complete ? "" : "; more remain for the next run"}`);
    await new PostgresMarketDataCacheStore(db).purgeExpired(Date.now());
    return Response.json({ ...result, expiredSessions });
  } catch (error) {
    console.error("anonymous cleanup failed", error);
    return Response.json({ error: "cleanup_failed" }, { status: 500 });
  }
}
