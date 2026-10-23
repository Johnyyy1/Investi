import { getCurrentUser } from "@/lib/session";
import { factToday } from "@/features/facts/resolve";
import { loadPortfolioRows } from "@/features/portfolio/repository";
import { taxRecordCsv } from "@/features/portfolio/tax-lots";

/** The signed-in learner's own practice trades as an educational record (lesson 2.4.9). */
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function GET() {
  const owner = await getCurrentUser();
  if (!owner) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    const rows = await loadPortfolioRows(owner.id);
    return new Response(taxRecordCsv(rows.trades, rows.readAt), { headers: { ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="investnik-evidence-obchodu-${factToday(rows.readAt)}.csv"` } });
  } catch { return Response.json({ error: "export_failed" }, { status: 500, headers }); }
}
