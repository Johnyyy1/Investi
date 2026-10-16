import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { account } from "@/db/schema";

/** Whether the user can confirm sensitive actions with a password (an e-mail and password sign-in). */
export async function hasPasswordCredential(userId: string) {
  const [row] = await db.select({ id: account.id }).from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential"), isNotNull(account.password))).limit(1);
  return Boolean(row);
}
