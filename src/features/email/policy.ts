import type { EmailMessage } from "./transport";

export const deliveryStatuses = ["queued", "sent", "failed", "delivered", "bounced", "complained"] as const;
export type DeliveryStatus = typeof deliveryStatuses[number];
/** Monotonic precedence: a late sent/delivered event can never clear a hard bounce or complaint. */
export function precedingStatuses(status: DeliveryStatus): DeliveryStatus[] {
  return deliveryStatuses.slice(0, deliveryStatuses.indexOf(status));
}
export function suppressesDelivery(kind: EmailMessage["kind"]) {
  // Recovery and account-security messages must still be attempted.
  return kind === "email-verification";
}
export const DELIVERY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
