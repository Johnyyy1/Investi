import { env } from "@/lib/env";
import { applyDeliveryEvent } from "@/features/email/repository";
import { verifyDeliveryWebhook } from "@/features/email/webhook";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!env.RESEND_WEBHOOK_SECRET) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const payload = await request.text();
  if (Buffer.byteLength(payload) > 256_000) return Response.json({ error: "too_large" }, { status: 413, headers });
  let event;
  try { event = verifyDeliveryWebhook(payload, request.headers, env.RESEND_WEBHOOK_SECRET); }
  catch { return Response.json({ error: "unauthorized" }, { status: 401, headers }); }
  try {
    if (event) await applyDeliveryEvent(event.messageId, event.status);
    return Response.json({ received: true }, { headers });
  } catch {
    // A 5xx makes Resend retry. Never print a provider payload or database exception containing values.
    console.error("[investi:email] Delivery event persistence failed.");
    return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers });
  }
}
