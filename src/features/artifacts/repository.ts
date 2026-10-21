import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { learnerArtifact, user } from "@/db/schema";
import { isGuestIdentity } from "@/features/guest/identity";
import { artifactContentSchema, artifactKindSchema, deleteArtifactSchema, saveArtifactSchema, type ArtifactKind, type ArtifactPayload, type LearnerArtifact, type SaveArtifactInput } from "./schemas";

import { getAuthoredLesson } from "@/features/lessons/registry";
import { availableLessons } from "@/features/learning/catalog";
import { validOutputForBlock } from "@/features/lessons/output-contract";

const outputBlock = sql<string>`${learnerArtifact.payload}->>'blockId'`;
const scopeLesson = sql<string>`case when ${learnerArtifact.kind} = 'lesson_output' then ${learnerArtifact.sourceLessonId} else '' end`;
const scopeBlock = sql<string>`case when ${learnerArtifact.kind} = 'lesson_output' then ${outputBlock} else '' end`;

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Pick<Transaction, "select">;
type ArtifactRow = typeof learnerArtifact.$inferSelect;

function present(row: ArtifactRow): LearnerArtifact {
  const content = artifactContentSchema.parse({ kind: row.kind, payload: row.payload });
  const definition = content.kind === "lesson_output" ? availableLessons.find((lesson) => lesson.id === row.sourceLessonId) : undefined;
  const blockId = content.kind === "lesson_output" ? content.payload.blockId : undefined;
  const block = definition && getAuthoredLesson(definition.moduleSlug, definition.slug)?.blocks.find((item) => item.id === blockId);
  const title = block && "title" in block ? block.title : undefined;
  return { ...content, ...(title ? { title } : {}), id: row.id, version: row.version, sourceLessonId: row.sourceLessonId, createdAt: row.createdAt.toISOString() } as LearnerArtifact;
}

function validAuthoredOutput(payload: ArtifactPayload<"lesson_output">, sourceLessonId: string | null) {
  const definition = availableLessons.find((lesson) => lesson.id === sourceLessonId);
  const block = definition && getAuthoredLesson(definition.moduleSlug, definition.slug)?.blocks.find((item) => item.id === payload.blockId);
  return Boolean(block && (block.type === "checklist" || block.type === "rubricSelfAssessment") && validOutputForBlock(block, payload));
}

/** Same lock as lesson progression and account lifecycle: saves, deletes and requirements serialize. */
async function lockOwner(tx: Transaction, userId: string) {
  const [owner] = await tx.select({ id: user.id, isAnonymous: user.isAnonymous, anonymousKind: user.anonymousKind }).from(user).where(eq(user.id, userId)).for("update");
  if (!owner || isGuestIdentity(owner)) throw new Error("A saved account or isolated demo is required.");
}

export async function saveLearnerArtifact(userId: string, input: SaveArtifactInput) {
  const parsed = saveArtifactSchema.parse(input);
  if (parsed.content.kind === "lesson_output" && !validAuthoredOutput(parsed.content.payload, parsed.sourceLessonId)) throw new Error("Invalid authored exercise output.");
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

/** Current revision per document: ordinary kinds, or lesson + block for exercise outputs. */
export async function listLearnerArtifacts(userId: string, kind?: ArtifactKind) {
  if (kind !== undefined) artifactKindSchema.parse(kind);
  const rows = await db.selectDistinctOn([learnerArtifact.kind, scopeLesson, scopeBlock]).from(learnerArtifact)
    .where(and(eq(learnerArtifact.userId, userId), kind === undefined ? undefined : eq(learnerArtifact.kind, kind)))
    .orderBy(learnerArtifact.kind, scopeLesson, scopeBlock, desc(learnerArtifact.version));
  return rows.map(present);
}

/** Any owned revision identifies the document; deletion removes its complete history. */
export async function deleteLearnerArtifact(userId: string, id: string) {
  deleteArtifactSchema.parse({ id });
  return db.transaction(async (tx) => {
    await lockOwner(tx, userId);
    const [owned] = await tx.select({ kind: learnerArtifact.kind, sourceLessonId: learnerArtifact.sourceLessonId, payload: learnerArtifact.payload }).from(learnerArtifact).where(and(eq(learnerArtifact.userId, userId), eq(learnerArtifact.id, id)));
    if (!owned) return; // Also makes a retry harmless and reveals no other learner's document.
    await tx.delete(learnerArtifact).where(and(eq(learnerArtifact.userId, userId), eq(learnerArtifact.kind, owned.kind),
      owned.kind === "lesson_output" ? eq(learnerArtifact.sourceLessonId, owned.sourceLessonId!) : undefined,
      owned.kind === "lesson_output" ? eq(outputBlock, (owned.payload as { blockId: string }).blockId) : undefined));
  });
}

/** Called inside the progression transaction after its user lock. Only the current revision counts. */
export async function hasValidArtifact(reader: Reader, userId: string, kind: ArtifactKind, sourceLessonId?: string, blockId?: string) {
  const [latest] = await reader.select().from(learnerArtifact)
    .where(and(eq(learnerArtifact.userId, userId), eq(learnerArtifact.kind, kind),
      kind === "lesson_output" && sourceLessonId ? eq(learnerArtifact.sourceLessonId, sourceLessonId) : undefined,
      kind === "lesson_output" && blockId ? eq(outputBlock, blockId) : undefined)).orderBy(desc(learnerArtifact.version)).limit(1);
  if (!latest || (sourceLessonId !== undefined && latest.sourceLessonId !== sourceLessonId)) return false;
  const content = artifactContentSchema.safeParse({ kind: latest.kind, payload: latest.payload });
  return content.success && (content.data.kind !== "lesson_output" || validAuthoredOutput(content.data.payload, latest.sourceLessonId));
}

/** Owned revision history, including legacy payloads; never accepts a client-supplied owner. */
export async function listLearnerArtifactHistory(userId: string, kind: ArtifactKind) {
  artifactKindSchema.parse(kind);
  const rows = await db.select().from(learnerArtifact)
    .where(and(eq(learnerArtifact.userId, userId), eq(learnerArtifact.kind, kind)))
    .orderBy(desc(learnerArtifact.version));
  return rows.map(present);
}
