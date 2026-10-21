import { curriculumLessons } from "@/features/learning/catalog";
import { displayModules, getLessonPlacement, type CurriculumLevelId } from "@/features/learning/curriculum";

/**
 * Reward policy v4, by curriculum level and independent of completion order:
 * - a first completion in L0, L1 or B earns XP only;
 * - finishing Foundations with the XP goal unlocks Portfolio Lab with a one-time grant (progression/unlocks.ts);
 * - a first completion in L2–L6 or V adds 2,000 Kč of Practice Capital. Capital earned
 *   before the unlock waits in the entitlement and becomes usable once the Lab opens.
 * Stored receipts keep the amount and version they were created with and are never recalculated:
 * v1 receipts hold 2,000 Kč per lesson, v2 receipts hold none, v3 follows the storage module.
 */
export const LEGACY_REWARD_POLICY_VERSION = 1;
export const XP_ONLY_REWARD_POLICY_VERSION = 2;
export const MODULE_REWARD_POLICY_VERSION = 3;
export const LEVEL_REWARD_POLICY_VERSION = 4;
/** The version new receipts are written with. @alias */
export const REWARD_POLICY_VERSION = LEVEL_REWARD_POLICY_VERSION;
/** Per first completion of a lesson in L2–L6 or V under policy v4. */
export const LESSON_PRACTICE_CAPITAL_MINOR = BigInt(200_000);
export const LEGACY_LESSON_PRACTICE_CAPITAL_MINOR = BigInt(200_000);

/** Exhaustive eligibility: adding a level requires a deliberate reward decision. */
const capitalByLevel = {
  L0: 0n,
  L1: 0n,
  L2: LESSON_PRACTICE_CAPITAL_MINOR,
  L3: LESSON_PRACTICE_CAPITAL_MINOR,
  L4: LESSON_PRACTICE_CAPITAL_MINOR,
  L5: LESSON_PRACTICE_CAPITAL_MINOR,
  L6: LESSON_PRACTICE_CAPITAL_MINOR,
  B: 0n,
  V: LESSON_PRACTICE_CAPITAL_MINOR,
} satisfies Record<CurriculumLevelId, bigint>;

export function practiceCapitalForLevel(levelId: CurriculumLevelId): bigint {
  return capitalByLevel[levelId];
}

/** The receipt amount and policy version for a first completion of this lesson. */
export function lessonReward(lessonId: string) {
  const lesson = curriculumLessons.find((entry) => entry.id === lessonId);
  if (!lesson) throw new Error(`Unknown lesson: ${lessonId}`);
  const placement = getLessonPlacement(lessonId);
  const displayModule = displayModules.find((module) => module.code === placement?.displayModule);
  // Never fall back to the storage module: that would fund L0/B lessons by accident.
  if (!displayModule) throw new Error(`Missing curriculum placement for lesson: ${lessonId}`);
  return {
    practiceCapitalMinor: practiceCapitalForLevel(displayModule.levelId),
    rewardPolicyVersion: REWARD_POLICY_VERSION,
  };
}

export type PracticeCapitalAward = {
  lessonId: string;
  practiceCapitalMinor: bigint;
  rewardPolicyVersion: number;
};

/** Exact receipt-derived entitlement; there is deliberately no mutable balance counter. */
export function getPracticeCapitalSummary(awards: readonly PracticeCapitalAward[], unlockGrants: readonly bigint[] = []) {
  const unique = new Map<string, PracticeCapitalAward>();
  for (const award of awards) {
    if (!unique.has(award.lessonId)) unique.set(award.lessonId, award);
  }
  return {
    earnedPracticeCapitalMinor: [...unique.values()].reduce(
      (total, award) => total + award.practiceCapitalMinor,
      unlockGrants.reduce((total, amount) => total + amount, BigInt(0)),
    ),
  };
}

/** One stored contribution to the entitlement: a lesson reward receipt or a progression unlock grant. */
export type PracticeCapitalReceipt =
  | { kind: "lesson"; lessonId: string; title: string; amountMinor: bigint; receivedAt: Date }
  | { kind: "unlock"; unlockId: string; reason: string; amountMinor: bigint; receivedAt: Date };

/** The receipts behind the entitlement, newest first. Zero-amount receipts (XP-only lessons, a grandfathered
 * unlock) add nothing, so they are left out of the entries but the total still sums every receipt. */
export function practiceCapitalLedger(receipts: readonly PracticeCapitalReceipt[]) {
  return {
    totalMinor: receipts.reduce((total, receipt) => total + receipt.amountMinor, BigInt(0)),
    entries: receipts.filter((receipt) => receipt.amountMinor > BigInt(0))
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime() || (a.kind === b.kind ? 0 : a.kind === "unlock" ? -1 : 1)),
  };
}
export type PracticeCapitalLedger = ReturnType<typeof practiceCapitalLedger>;
