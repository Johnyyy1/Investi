import { getCurrentUser } from "@/lib/session";
import { isGuestIdentity } from "@/features/guest/identity";
import { listLearnerArtifactHistory } from "@/features/artifacts/repository";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function GET() {
  const owner = await getCurrentUser();
  if (!owner || isGuestIdentity(owner)) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    const versions = await listLearnerArtifactHistory(owner.id, "investment_plan");
    return Response.json({ format: "investi-ips-export", formatVersion: 1, exportedAt: new Date().toISOString(), versions }, { headers: { ...headers,
      "Content-Disposition": 'attachment; filename="investi-investicni-plan.json"' } });
  } catch { return Response.json({ error: "export_failed" }, { status: 500, headers }); }
}
