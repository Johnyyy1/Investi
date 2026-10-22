import { Webhook } from "svix";
import { z } from "zod";

const eventSchema = z.object({ type: z.string(), data: z.object({ email_id: z.string().min(1).max(200) }) });
const states = { "email.sent": "sent", "email.failed": "failed", "email.delivered": "delivered", "email.bounced": "bounced", "email.complained": "complained" } as const;

/** Verification uses the exact raw body, Svix timestamp tolerance and constant-time signature checks. */
export function verifyDeliveryWebhook(payload: string, headers: Headers, secret: string) {
  new Webhook(secret).verify(payload, {
    "svix-id": headers.get("svix-id") ?? "",
    "svix-timestamp": headers.get("svix-timestamp") ?? "",
    "svix-signature": headers.get("svix-signature") ?? "",
  });
  const event = eventSchema.safeParse(JSON.parse(payload));
  if (!event.success || !Object.hasOwn(states, event.data.type)) return null;
  // Discard the recipient and all other provider payload fields before crossing into persistence.
  return { messageId: event.data.data.email_id, status: states[event.data.type as keyof typeof states] };
}
