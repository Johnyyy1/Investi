import type { AuthoredLesson } from "@/features/lessons/types";
import { prepareLessonFacts } from "./lesson-facts";
import { validateFactRegistry } from "./resolve";
import type { FactVersion } from "./types";

export function checkPublishedFacts(registry: readonly FactVersion[], lessons: readonly AuthoredLesson[], definitions: readonly { id: string; status: string }[], today: string) {
  validateFactRegistry(registry);
  for (const definition of definitions.filter((item) => item.status === "available")) {
    const lesson = lessons.find((item) => item.id === definition.id);
    if (!lesson) throw new Error(`Published lesson has no authored content: ${definition.id}`);
    prepareLessonFacts(lesson, registry, { today, published: true });
  }
}
