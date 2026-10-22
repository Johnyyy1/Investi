import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailDelivery, user } from "@/db/schema";
import { DELIVERY_RETENTION_MS, precedingStatuses, type DeliveryStatus } from "./policy";
import type { EmailMessage, EmailTransport } from "./transport";

export async function hasSuppressedEmail(userId: string, recipient?: string) {
  const [row] = await db.select({ id: emailDelivery.id }).from(emailDelivery).innerJoin(user, eq(user.id, emailDelivery.userId)).where(and(
    eq(user.id, userId), recipient ? eq(user.email, recipient.toLowerCase()) : undefined, eq(emailDelivery.addressEpoch, user.emailDeliveryEpoch), inArray(emailDelivery.status, ["bounced", "complained"]),
  )).limit(1);
  return Boolean(row);
}

export async function queueDelivery(message: EmailMessage & { userId: string }, provider: EmailTransport["name"]) {
  const owner = await db.query.user.findFirst({ where: eq(user.id, message.userId), columns: { email: true, emailDeliveryEpoch: true } });
  if (!owner) throw new Error("Email owner unavailable.");
  const id = randomUUID();
  await db.insert(emailDelivery).values({ id, userId: message.userId, kind: message.kind, provider, addressEpoch: message.to.toLowerCase() === owner.email.toLowerCase() ? owner.emailDeliveryEpoch : null });
  return id;
}
export async function recordSent(id: string, providerMessageId: string) {
  await db.update(emailDelivery).set({ providerMessageId, status: "sent", updatedAt: new Date() }).where(and(eq(emailDelivery.id, id), eq(emailDelivery.status, "queued")));
}
export async function recordFailed(id: string, errorCode: string) {
  await db.update(emailDelivery).set({ status: "failed", errorCode, updatedAt: new Date() }).where(and(eq(emailDelivery.id, id), eq(emailDelivery.status, "queued")));
}

/** The conditional UPDATE is atomic under concurrent events and replay leaves updated_at unchanged. */
export async function applyDeliveryEvent(providerMessageId: string, status: DeliveryStatus) {
  const earlier = precedingStatuses(status);
  if (!earlier.length) return;
  await db.update(emailDelivery).set({ status, errorCode: status === "failed" ? "provider_failed" : null, updatedAt: new Date() }).where(and(
    eq(emailDelivery.providerMessageId, providerMessageId), inArray(emailDelivery.status, earlier),
  ));
}

/** Bounded cleanup, reusing the existing authorized daily cron; no new scheduler is required. */
export async function deleteExpiredDeliveries({ now = new Date(), batchSize = 1000, maxBatches = 20 }: { now?: Date; batchSize?: number; maxBatches?: number } = {}) {
  const cutoff = new Date(now.getTime() - DELIVERY_RETENTION_MS).toISOString();
  let removed = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const rows = await db.execute<{ count: number }>(sql`
      with doomed as (select id from ${emailDelivery} where created_at < ${cutoff}::timestamptz limit ${batchSize} for update skip locked),
      deleted as (delete from ${emailDelivery} where id in (select id from doomed) returning 1)
      select count(*)::int as count from deleted`);
    const count = Number(rows[0]?.count ?? 0);
    removed += count;
    if (count < batchSize) return { removed, complete: true };
  }
  return { removed, complete: false };
}
