import type { AuthoredLesson } from "@/features/lessons/types";
import { contentReviews, type ContentReview } from "./content-reviews";
import { prepareLessonFacts } from "./lesson-facts";
import { calendarDate, resolveFact, validateFactRegistry } from "./resolve";
import type { FactVersion } from "./types";

const expertReviewed = new Set(["tax", "regulatory"]);

export function checkPublishedFacts(registry: readonly FactVersion[], lessons: readonly AuthoredLesson[], definitions: readonly { id: string; status: string }[], today: string, reviews: readonly ContentReview[] = contentReviews) {
  validateFactRegistry(registry);
  for (const review of reviews) if (calendarDate(review.reviewedAt) > today) throw new Error(`Future content review for ${review.lessonId}`);
  for (const definition of definitions.filter((item) => item.status === "available")) {
    const lesson = lessons.find((item) => item.id === definition.id);
    if (!lesson) throw new Error(`Published lesson has no authored content: ${definition.id}`);
    const { facts } = prepareLessonFacts(lesson, registry, { today, published: true });
    if (!expertReviewed.has(lesson.factContext?.kind ?? "")) continue;
    const latest = reviews.filter((review) => review.lessonId === lesson.id).sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt)).at(-1);
    if (latest?.decision !== "approved") throw new Error(`Published ${lesson.factContext?.kind} lesson ${lesson.id} has no expert review approval`);
    // factNotice blocks render today's versions themselves; the approval must cover those too.
    const notices = lesson.blocks.flatMap((block) => block.type === "factNotice" ? block.factKeys.map((key) => resolveFact(key, today, registry)) : []);
    const current = [...new Set([...facts, ...notices].map((fact) => `${fact.key}@${fact.version}`))].sort();
    if (current.join() !== [...latest.facts].sort().join()) throw new Error(`Expert review of ${lesson.id} does not cover the current fact versions (needs update): ${current.join(", ")}`);
  }
}
