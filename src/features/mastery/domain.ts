import { displayModules, getLessonPlacement, skillItems, type DisplayModuleCode, type SkillId, type SkillItem } from "@/features/learning/curriculum";
import type { AttemptContext } from "./contexts";

/**
 * Skill mastery (#122). The state is derived from append-only attempts every time, never stored or counted up,
 * the same principle as Practice Capital. It is separate from lesson completion and never affects rewards or access.
 */
export type SkillAttempt = { context: AttemptContext; correct: boolean; attemptedAt: Date };

/** Index = level. 0 means no attempt yet. */
export const masteryLabels = ["Nezkoušeno", "Zkoušeno", "Známé", "Zvládnuté", "Ovládnuté"] as const;
export type MasteryLevel = 0 | 1 | 2 | 3 | 4;
export const MASTERED: MasteryLevel = 3;
/** Design proposal from #122, to validate with learners; not a research-established constant. */
export const REVIEW_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Zkoušeno = any attempt; Známé = correct in a lesson; Zvládnuté = correct in a mixed checkpoint;
 * Ovládnuté = correct in a review at least REVIEW_DELAY_MS after reaching Zvládnuté.
 * A wrong review lowers the state one level (never below Zkoušeno) and restarts the delay.
 * `completedLesson`: a finished lesson already proved its questions, so it counts as Známé without a backfill.
 */
export function skillLevel(attempts: readonly SkillAttempt[], completedLesson = false) {
  let level: MasteryLevel = completedLesson ? 2 : 0;
  let masteredAt: Date | null = null;
  for (const attempt of [...attempts].sort((a, b) => a.attemptedAt.getTime() - b.attemptedAt.getTime())) {
    const at = attempt.attemptedAt;
    if (level === 0) level = 1;
    if (!attempt.correct) {
      if (attempt.context !== "review") continue;
      level = Math.max(1, level - 1) as MasteryLevel;
      masteredAt = level >= MASTERED ? at : null;
    } else if (attempt.context === "lesson") {
      if (level < 2) level = 2;
    } else if (level < MASTERED) {
      level = MASTERED; masteredAt = at;
    } else if (attempt.context === "review" && masteredAt && at.getTime() - masteredAt.getTime() >= REVIEW_DELAY_MS) {
      level = 4;
    }
  }
  return level;
}

/** A checkpoint answer on a skill that is already Zvládnuté is delayed retrieval, so it is recorded as a review. */
export function checkpointContext(currentLevel: MasteryLevel): AttemptContext {
  return currentLevel >= MASTERED ? "review" : "checkpoint";
}

export function getSkillItem(id: string) {
  return skillItems.find((entry) => entry.id === id);
}
function moduleItems(code: string) {
  return skillItems.filter((entry) => getLessonPlacement(entry.lessonId)?.displayModule === code);
}
/** Display modules whose item bank spans at least two lessons, so a checkpoint can interleave them. */
export const checkpointModules = displayModules.filter((entry) => new Set(moduleItems(entry.code).map((item) => item.lessonId)).size >= 2);
export function isCheckpointModule(code: string): code is DisplayModuleCode {
  return checkpointModules.some((entry) => entry.code === code);
}
export function moduleSkills(code: DisplayModuleCode): SkillId[] {
  return [...new Set(moduleItems(code).map((entry) => entry.skillId))];
}

/** FNV-1a: a small, stable string hash for seeding; not for security. */
function hash(value: string) {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 0x01000193) >>> 0;
  return result;
}

/**
 * One item per skill of the module, chosen by `seed`, then dealt round-robin across lessons so consecutive
 * questions come from different lessons. The same seed always gives the same set and order.
 */
export function mixedCheckpoint(code: DisplayModuleCode, seed: string): SkillItem[] {
  const bank = moduleItems(code);
  const picked = moduleSkills(code).map((skillId) => {
    const options = bank.filter((entry) => entry.skillId === skillId);
    return options[hash(`${seed}:${skillId}`) % options.length];
  });
  const lessons = [...new Set(picked.map((entry) => entry.lessonId))];
  const start = hash(seed) % lessons.length;
  const queues = [...lessons.slice(start), ...lessons.slice(0, start)].map((lessonId) => picked.filter((entry) => entry.lessonId === lessonId));
  const dealt: SkillItem[] = [];
  while (dealt.length < picked.length) for (const queue of queues) if (queue.length) dealt.push(queue.shift()!);
  return dealt;
}
