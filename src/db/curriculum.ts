import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { learningModule, lesson } from "./schema";
import { availableLessons, getModuleLessons, moduleCatalog } from "@/features/learning/catalog";

type Database = PostgresJsDatabase<Record<string, unknown>>;

const availableModules = () => moduleCatalog.filter((module) => module.status === "available");

/** Upserts every available module and its lessons from the code catalog. Safe to run on every deploy. */
export async function seedCurriculum(db: Database) {
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const [index, module] of availableModules().entries()) {
      const definitions = getModuleLessons(module.slug);
      const moduleId = definitions[0].moduleId;
      await tx.insert(learningModule).values({ id: moduleId, slug: module.slug, title: module.title, description: module.description, position: index + 1, isPublished: true, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: learningModule.id, set: { title: module.title, description: module.description, position: index + 1, isPublished: true, updatedAt: now } });
      await tx.insert(lesson).values(definitions.map((definition, position) => ({ id: definition.id, moduleId, slug: definition.slug, title: definition.title, summary: definition.summary, position: position + 1, estimatedMinutes: definition.estimatedMinutes, isPublished: definition.status === "available", createdAt: now, updatedAt: now }))).onConflictDoUpdate({ target: lesson.id, set: { title: sql`excluded.title`, summary: sql`excluded.summary`, position: sql`excluded.position`, estimatedMinutes: sql`excluded.estimated_minutes`, isPublished: sql`excluded.is_published`, updatedAt: now } });
    }
  });
}

type PublishedRow = { id: string; moduleId?: string; isPublished: boolean };

/**
 * Catalog entries the database cannot serve. Progress and awards reference `lesson.id`, so an
 * available lesson without a published row in its module cannot be saved or completed.
 */
export function findMissingCurriculum(rows: { modules: PublishedRow[]; lessons: PublishedRow[] }) {
  const publishedModules = new Set(rows.modules.filter((row) => row.isPublished).map((row) => row.id));
  const publishedLessons = new Map(rows.lessons.filter((row) => row.isPublished).map((row) => [row.id, row.moduleId]));
  return {
    modules: availableModules().map((module) => module.slug).filter((slug) => !publishedModules.has(getModuleLessons(slug)[0].moduleId)),
    lessons: availableLessons.filter((definition) => publishedLessons.get(definition.id) !== definition.moduleId).map((definition) => definition.id),
  };
}

/** Throws when the database is missing any module or lesson the catalog publishes. Read-only. */
export async function assertCurriculumComplete(db: Pick<Database, "select">) {
  const [modules, lessons] = await Promise.all([
    db.select({ id: learningModule.id, isPublished: learningModule.isPublished }).from(learningModule),
    db.select({ id: lesson.id, moduleId: lesson.moduleId, isPublished: lesson.isPublished }).from(lesson),
  ]);
  const missing = findMissingCurriculum({ modules, lessons });
  if (missing.modules.length || missing.lessons.length) {
    throw new Error(
      `Curriculum is missing from the database (run \`npm run db:seed\`). Modules: ${missing.modules.join(", ") || "none"}. Lessons: ${missing.lessons.join(", ") || "none"}.`,
    );
  }
  return { modules: availableModules().length, lessons: availableLessons.length };
}
