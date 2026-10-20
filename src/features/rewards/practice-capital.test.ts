import { describe, expect, it } from "vitest";
import { availableLessons, curriculumLessons } from "@/features/learning/catalog";
import { FOUNDATIONS_MODULE_ID } from "@/features/lessons/foundations/manifest";
import {
  LEGACY_LESSON_PRACTICE_CAPITAL_MINOR,
  LEGACY_REWARD_POLICY_VERSION,
  LESSON_PRACTICE_CAPITAL_MINOR,
  MODULE_REWARD_POLICY_VERSION,
  REWARD_POLICY_VERSION,
  XP_ONLY_REWARD_POLICY_VERSION,
  getPracticeCapitalSummary,
  lessonReward,
  practiceCapitalLedger,
} from "./practice-capital";

const foundations = availableLessons.filter((lesson) => lesson.moduleId === FOUNDATIONS_MODULE_ID);
const beyondFoundations = availableLessons.filter((lesson) => lesson.moduleId !== FOUNDATIONS_MODULE_ID);

describe("Practice Capital reward policy v3", () => {
  it("records new receipts under policy v3 with 2,000 Kč beyond Foundations", () => {
    expect(REWARD_POLICY_VERSION).toBe(MODULE_REWARD_POLICY_VERSION);
    expect(MODULE_REWARD_POLICY_VERSION).toBe(3);
    expect(LESSON_PRACTICE_CAPITAL_MINOR).toBe(200_000n);
  });

  it("awards XP only for every Foundations lesson", () => {
    expect(foundations.length).toBeGreaterThan(0);
    for (const lesson of foundations) expect(lessonReward(lesson.id)).toEqual({ practiceCapitalMinor: 0n, rewardPolicyVersion: 3 });
  });

  it("awards 2,000 Kč for every lesson outside Foundations, independent of completion order", () => {
    expect(beyondFoundations.length).toBeGreaterThan(0);
    for (const lesson of beyondFoundations) expect(lessonReward(lesson.id)).toEqual({ practiceCapitalMinor: 200_000n, rewardPolicyVersion: 3 });
  });

  it("follows the module for planned lessons too, so publishing one needs no policy change", () => {
    for (const lesson of curriculumLessons.filter((entry) => entry.status === "planned")) {
      expect(lessonReward(lesson.id).practiceCapitalMinor).toBe(lesson.moduleId === FOUNDATIONS_MODULE_ID ? 0n : 200_000n);
    }
  });

  it("refuses to price a lesson outside the curriculum", () => {
    expect(() => lessonReward("not-a-lesson")).toThrow();
  });
});

describe("Practice Capital entitlement", () => {
  it("keeps every stored receipt amount and adds unlock grants", () => {
    const awards = [
      { lessonId: "a", practiceCapitalMinor: LEGACY_LESSON_PRACTICE_CAPITAL_MINOR, rewardPolicyVersion: LEGACY_REWARD_POLICY_VERSION },
      { lessonId: "b", practiceCapitalMinor: 0n, rewardPolicyVersion: XP_ONLY_REWARD_POLICY_VERSION },
      { lessonId: foundations[0].id, ...lessonReward(foundations[0].id) },
      { lessonId: beyondFoundations[0].id, ...lessonReward(beyondFoundations[0].id) },
    ];
    // 2,000 (v1) + 0 (v2) + 0 (v3 Foundations) + 2,000 (v3 beyond) + 5,000 (unlock) = 9,000 Kč.
    expect(getPracticeCapitalSummary(awards, [500_000n])).toEqual({ earnedPracticeCapitalMinor: 900_000n });
  });

  it("counts each lesson receipt once without deriving capital from XP", () => {
    const receipt = { lessonId: "lesson-a", xp: 0, practiceCapitalMinor: LEGACY_LESSON_PRACTICE_CAPITAL_MINOR, rewardPolicyVersion: LEGACY_REWARD_POLICY_VERSION };
    const awards = [receipt, { ...receipt, xp: 999_999, practiceCapitalMinor: 999_999n }];

    expect(getPracticeCapitalSummary(awards)).toEqual({ earnedPracticeCapitalMinor: LEGACY_LESSON_PRACTICE_CAPITAL_MINOR });
  });
});

describe("Practice Capital ledger", () => {
  const at = (day: number) => new Date(Date.UTC(2026, 8, day, 10));
  const lesson = (lessonId: string, amountMinor: bigint, day: number) => ({ kind: "lesson" as const, lessonId, title: lessonId, amountMinor, receivedAt: at(day) });
  const unlock = (amountMinor: bigint, day: number, reason = "learning_requirements") => ({ kind: "unlock" as const, unlockId: "PORTFOLIO_LAB", reason, amountMinor, receivedAt: at(day) });

  it("lists the paying receipts newest first and sums every receipt exactly", () => {
    const receipts = [lesson("foundations-a", 0n, 1), unlock(500_000n, 2), lesson("returns-a", 200_000n, 3), lesson("legacy-a", LEGACY_LESSON_PRACTICE_CAPITAL_MINOR, 1)];
    const ledger = practiceCapitalLedger(receipts);
    expect(ledger.totalMinor).toBe(900_000n);
    expect(ledger.entries.map((entry) => entry.kind === "lesson" ? entry.lessonId : entry.unlockId)).toEqual(["returns-a", "PORTFOLIO_LAB", "legacy-a"]);
    expect(ledger.entries.reduce((total, entry) => total + entry.amountMinor, 0n)).toBe(ledger.totalMinor);
  });

  it("keeps amounts that do not round to whole koruna and never shows zero receipts", () => {
    const ledger = practiceCapitalLedger([lesson("a", 1n, 1), lesson("b", 133n, 2), unlock(0n, 3, "existing_portfolio")]);
    expect(ledger.totalMinor).toBe(134n);
    expect(ledger.entries).toHaveLength(2);
  });

  it("puts an unlock before a lesson receipt written in the same instant", () => {
    const ledger = practiceCapitalLedger([lesson("returns-a", 200_000n, 2), unlock(500_000n, 2)]);
    expect(ledger.entries.map((entry) => entry.kind)).toEqual(["unlock", "lesson"]);
  });

  it("is zero and empty without receipts", () => {
    expect(practiceCapitalLedger([])).toEqual({ totalMinor: 0n, entries: [] });
  });
});
