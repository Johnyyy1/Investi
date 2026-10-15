import { db } from "@/db";
import { deleteUnreachableAnonymousIdentities } from "@/features/guest/cleanup";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { env } from "@/lib/env";

/** Daily Vercel Cron job (vercel.json): removes anonymous identities nobody can sign in to any more. */
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await deleteUnreachableAnonymousIdentities(db);
    console.info(`anonymous cleanup: removed ${result.removed.demo} demo and ${result.removed.guest} guest identities${result.complete ? "" : "; more remain for the next run"}`);
    return Response.json(result);
  } catch (error) {
    console.error("anonymous cleanup failed", error);
    return Response.json({ error: "cleanup_failed" }, { status: 500 });
  }
}
