import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { learnerArtifact, user } from "@/db/schema";
import { isGuestIdentity } from "@/features/guest/identity";
import { artifactContentSchema, artifactKindSchema, deleteArtifactSchema, saveArtifactSchema, type ArtifactKind, type LearnerArtifact, type SaveArtifactInput } from "./schemas";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Pick<Transaction, "select">;
type ArtifactRow = typeof learnerArtifact.$inferSelect;

function present(row: ArtifactRow): LearnerArtifact {
  const content = artifactContentSchema.parse({ kind: row.kind, payload: row.payload });
  return { ...content, id: row.id, version: row.version, sourceLessonId: row.sourceLessonId, createdAt: row.createdAt.toISOString() } as LearnerArtifact;
}

/** Same lock as lesson progression and account lifecycle: saves, deletes and requirements serialize. */
async function lockOwner(tx: Transaction, userId: string) {
  const [owner] = await tx.select({ id: user.id, isAnonymous: user.isAnonymous, anonymousKind: user.anonymousKind }).from(user).where(eq(user.id, userId)).for("update");
  if (!owner || isGuestIdentity(owner)) throw new Error("A saved account or isolated demo is required.");
}

export async function saveLearnerArtifact(userId: string, input: SaveArtifactInput) {
  const parsed = saveArtifactSchema.parse(input);
  return db.transaction(async (tx) => {
    await lockOwner(tx, userId);
    const [retry] = await tx.select().from(learnerArtifact).where(and(eq(learnerArtifact.userId, userId), eq(learnerArtifact.requestId, parsed.requestId)));
    if (retry) {
      if (retry.kind !== parsed.content.kind || retry.sourceLessonId !== parsed.sourceLessonId || JSON.stringify(present(retry).payload) !== JSON.stringify(parsed.content.payload)) {
        throw new Error("An artifact request cannot be reused for different content.");
      }
      return present(retry);
    }
    const [latest] = await tx.select({ version: learnerArtifact.version }).from(learnerArtifact)
      .where(and(eq(learnerArtifact.userId, userId), eq(learnerArtifact.kind, parsed.content.kind))).orderBy(desc(learnerArtifact.version)).limit(1);
    const [created] = await tx.insert(learnerArtifact).values({
      id: randomUUID(), userId, kind: parsed.content.kind, payload: parsed.content.payload,
      version: (latest?.version ?? 0) + 1, sourceLessonId: parsed.sourceLessonId, requestId: parsed.requestId,
    }).returning();
    return present(created);
  });
}

/** Newest revision per kind, ordered by revision rather than timestamp ties. No cross-request cache. */
export async function listLearnerArtifacts(userId: string, kind?: ArtifactKind) {
  if (kind !== undefined) artifactKindSchema.parse(kind);
  const rows = await db.selectDistinctOn([learnerArtifact.kind]).from(learnerArtifact)
    .where(and(eq(learnerArtifact.userId, userId), kind === undefined ? undefined : eq(learnerArtifact.kind, kind)))
    .orderBy(learnerArtifact.kind, desc(learnerArtifact.version));
  return rows.map(present);
}

/** Any owned revision identifies the document; deletion removes its complete history. */
export async function deleteLearnerArtifact(userId: string, id: string) {
  deleteArtifactSchema.parse({ id });
  return db.transaction(async (tx) => {
    await lockOwner(tx, userId);
    const [owned] = await tx.select({ kind: learnerArtifact.kind }).from(learnerArtifact).where(and(eq(learnerArtifact.userId, userId), eq(learnerArtifact.id, id)));
    if (!owned) return; // Also makes a retry harmless and reveals no other learner's document.
    await tx.delete(learnerArtifact).where(and(eq(learnerArtifact.userId, userId), eq(learnerArtifact.kind, owned.kind)));
  });
}

/** Called inside the progression transaction after its user lock. Only the current revision counts. */
export async function hasValidArtifact(reader: Reader, userId: string, kind: ArtifactKind, sourceLessonId?: string) {
  const [latest] = await reader.select().from(learnerArtifact)
    .where(and(eq(learnerArtifact.userId, userId), eq(learnerArtifact.kind, kind))).orderBy(desc(learnerArtifact.version)).limit(1);
  return Boolean(latest && (sourceLessonId === undefined || latest.sourceLessonId === sourceLessonId)
    && artifactContentSchema.safeParse({ kind: latest.kind, payload: latest.payload }).success);
}

/** Owned revision history, including legacy payloads; never accepts a client-supplied owner. */
export async function listLearnerArtifactHistory(userId: string, kind: ArtifactKind) {
  artifactKindSchema.parse(kind);
  const rows = await db.select().from(learnerArtifact)
    .where(and(eq(learnerArtifact.userId, userId), eq(learnerArtifact.kind, kind)))
    .orderBy(desc(learnerArtifact.version));
  return rows.map(present);
}
