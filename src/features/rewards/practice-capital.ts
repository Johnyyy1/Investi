import { curriculumLessons } from "@/features/learning/catalog";
import { FOUNDATIONS_MODULE_ID } from "@/features/lessons/foundations/manifest";

/**
 * Reward policy v3, by module and independent of completion order:
 * - a first completion of a Foundations lesson earns XP only;
 * - finishing Foundations with the XP goal unlocks Portfolio Lab with a one-time grant (progression/unlocks.ts);
 * - a first completion of any lesson outside Foundations adds 2,000 Kč of Practice Capital. Capital earned
 *   before the unlock waits in the entitlement and becomes usable once the Lab opens.
 * Stored receipts keep the amount and version they were created with and are never recalculated:
 * v1 receipts hold 2,000 Kč per lesson, v2 receipts hold none.
 */
export const LEGACY_REWARD_POLICY_VERSION = 1;
export const XP_ONLY_REWARD_POLICY_VERSION = 2;
export const MODULE_REWARD_POLICY_VERSION = 3;
/** The version new receipts are written with. @alias */
export const REWARD_POLICY_VERSION = MODULE_REWARD_POLICY_VERSION;
/** Per first completion of a lesson outside Foundations under policy v3. */
export const LESSON_PRACTICE_CAPITAL_MINOR = BigInt(200_000);
export const LEGACY_LESSON_PRACTICE_CAPITAL_MINOR = BigInt(200_000);

/** The receipt amount and policy version for a first completion of this lesson. */
export function lessonReward(lessonId: string) {
  const lesson = curriculumLessons.find((entry) => entry.id === lessonId);
  if (!lesson) throw new Error(`Unknown lesson: ${lessonId}`);
  return {
    practiceCapitalMinor: lesson.moduleId === FOUNDATIONS_MODULE_ID ? BigInt(0) : LESSON_PRACTICE_CAPITAL_MINOR,
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
