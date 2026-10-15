import type { Gamification } from "@/features/gamification/domain";
import type { SerializedPracticeCapitalMinor } from "@/features/rewards/presentation";

export type LearningMomentum = Pick<Gamification, "streak" | "todayCompleted" | "dailyTarget" | "timeZone">;

export type CompletionRewardPresentation = {
  xpAwarded: number;
  totalXp: number;
  portfolioLabUnlocked: boolean;
  /** Whether the learner can use Practice Capital now; capital earned before the unlock waits for it. */
  portfolioLabOpen: boolean;
  unlockCapitalAwardedMinor: SerializedPracticeCapitalMinor;
  practiceCapitalAwardedMinor: SerializedPracticeCapitalMinor;
  earnedPracticeCapitalMinor: SerializedPracticeCapitalMinor;
  learningMomentum: LearningMomentum;
  nextHref: string;
  nextTitle: string;
  allComplete: boolean;
};

/** Learning momentum remains separate from the XP reward ledger. */
export function toLearningMomentum(gamification: Gamification): LearningMomentum {
  return {
    streak: gamification.streak,
    todayCompleted: gamification.todayCompleted,
    dailyTarget: gamification.dailyTarget,
    timeZone: gamification.timeZone,
  };
}
