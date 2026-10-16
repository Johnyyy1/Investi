import { db } from "@/db";
import { accountExportFilename, buildAccountExport, readAccountExportRows, serializeAccountExport } from "@/features/account/export";
import { rateLimiter } from "@/features/rate-limit";
import { ACCOUNT_EXPORT_USER_RULE } from "@/features/rate-limit/policy";
import { auth } from "@/lib/auth";

/** "Stáhnout moje data": the signed-in user's own data as a JSON download. There is no way to name another user. */
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const current = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!current) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  try {
    const decision = await rateLimiter.consume([{ scope: "account:export", subject: current.user.id, rule: ACCOUNT_EXPORT_USER_RULE }]);
    if (!decision.allowed) {
      const retryAfter = String(decision.retryAfterSeconds);
      return Response.json({ error: "rate_limited" }, { status: 429, headers: { ...noStore, "Retry-After": retryAfter } });
    }
    const rows = await readAccountExportRows(db, current.user.id);
    if (!rows) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
    const exportedAt = new Date();
    return new Response(serializeAccountExport(buildAccountExport(rows, exportedAt)), { headers: {
      ...noStore,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${accountExportFilename(exportedAt)}"`,
    } });
  } catch (error) {
    console.error("account export failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "export_failed" }, { status: 500, headers: noStore });
  }
}
