import { FOUNDATIONS_MODULE_ID, foundationsLessons } from "@/features/lessons/foundations/manifest";

export const PORTFOLIO_LAB_UNLOCK_ID = "PORTFOLIO_LAB";
export const PORTFOLIO_LAB_UNLOCK_CAPITAL_MINOR = 500_000n;

const foundationsLessonIds = foundationsLessons.filter((lesson) => lesson.status === "available").map((lesson) => lesson.id);

/** Seven published Foundations lessons earn 7 × 60 = 420 XP. The threshold is named
 * separately so later learning content can contribute without changing the prerequisite. */
export const progressionUnlocks = {
  [PORTFOLIO_LAB_UNLOCK_ID]: {
    id: PORTFOLIO_LAB_UNLOCK_ID,
    name: "Portfolio Lab",
    xpRequired: 420,
    prerequisiteModuleIds: [FOUNDATIONS_MODULE_ID],
    prerequisiteLessonIds: foundationsLessonIds,
    rewardPracticeCapitalMinor: PORTFOLIO_LAB_UNLOCK_CAPITAL_MINOR,
  },
} as const;

export type UnlockId = keyof typeof progressionUnlocks;
export type LearningProgression = { totalXp: number; completedLessonIds: ReadonlySet<string> };

/** A guest has not saved an account yet, so nothing is unlocked or recorded until they do. */
export function evaluateUnlock(id: UnlockId, progression: LearningProgression, persisted = false, isDemo = false, isGuest = false) {
  const definition = progressionUnlocks[id];
  const completedPrerequisiteLessons = definition.prerequisiteLessonIds.filter((lessonId) => progression.completedLessonIds.has(lessonId)).length;
  const requiredPrerequisiteLessons = definition.prerequisiteLessonIds.length;
  const prerequisitesComplete = completedPrerequisiteLessons === requiredPrerequisiteLessons;
  return {
    id,
    name: definition.name,
    totalXp: progression.totalXp,
    xpRequired: definition.xpRequired,
    completedPrerequisiteLessons,
    requiredPrerequisiteLessons,
    prerequisitesComplete,
    requiresAccount: isGuest,
    unlocked: !isGuest && (persisted || isDemo || (progression.totalXp >= definition.xpRequired && prerequisitesComplete)),
  };
}

export type PortfolioLabUnlockFacts = { progression: LearningProgression; recorded: boolean; grandfathered: boolean; isDemo: boolean; isGuest?: boolean };

/** A recorded unlock is never removed, so only an unlocked account without a record needs the locked write path. */
export function resolvePortfolioLabUnlock({ progression, recorded, grandfathered, isDemo, isGuest = false }: PortfolioLabUnlockFacts) {
  const status = evaluateUnlock(PORTFOLIO_LAB_UNLOCK_ID, progression, recorded || grandfathered, isDemo, isGuest);
  return { status, needsRecord: !recorded && status.unlocked };
}
