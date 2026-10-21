import { describe, expect, it } from "vitest";
import { availableLessons, curriculumLessons } from "@/features/learning/catalog";
import { FOUNDATIONS_MODULE_ID } from "@/features/lessons/foundations/manifest";
import { curriculumLevels, displayModules, getLessonPlacement } from "@/features/learning/curriculum";
import {
  LEGACY_LESSON_PRACTICE_CAPITAL_MINOR,
  LEGACY_REWARD_POLICY_VERSION,
  LESSON_PRACTICE_CAPITAL_MINOR,
  MODULE_REWARD_POLICY_VERSION,
  LEVEL_REWARD_POLICY_VERSION,
  REWARD_POLICY_VERSION,
  XP_ONLY_REWARD_POLICY_VERSION,
  getPracticeCapitalSummary,
  lessonReward,
  practiceCapitalForLevel,
  practiceCapitalLedger,
} from "./practice-capital";

const foundations = availableLessons.filter((lesson) => lesson.moduleId === FOUNDATIONS_MODULE_ID);
const beyondFoundations = availableLessons.filter((lesson) => lesson.moduleId !== FOUNDATIONS_MODULE_ID);

describe("Practice Capital reward policy v4", () => {
  it("versions new receipts prospectively and retains the historical policy identities", () => {
    expect(REWARD_POLICY_VERSION).toBe(LEVEL_REWARD_POLICY_VERSION);
    expect(LEVEL_REWARD_POLICY_VERSION).toBe(4);
    expect(MODULE_REWARD_POLICY_VERSION).toBe(3);
    expect(LESSON_PRACTICE_CAPITAL_MINOR).toBe(200_000n);
  });

  it("awards XP only for every Foundations lesson", () => {
    expect(foundations.length).toBeGreaterThan(0);
    for (const lesson of foundations) expect(lessonReward(lesson.id)).toEqual({ practiceCapitalMinor: 0n, rewardPolicyVersion: 4 });
  });

  it.each(curriculumLevels.map(({ id }) => [id, ["L0", "L1", "B"].includes(id) ? 0n : 200_000n] as const))("sets the first-completion capital for %s to %s minor units", (levelId, expected) => {
    expect(practiceCapitalForLevel(levelId)).toBe(expected);
  });

  it("resolves every published lesson through its registry level, independent of storage module or completion order", () => {
    expect(beyondFoundations.length).toBeGreaterThan(0);
    for (const lesson of availableLessons) {
      const placement = getLessonPlacement(lesson.id)!;
      const level = displayModules.find((module) => module.code === placement.displayModule)!.levelId;
      expect(lessonReward(lesson.id)).toEqual({ practiceCapitalMinor: ["L0", "L1", "B"].includes(level) ? 0n : 200_000n, rewardPolicyVersion: 4 });
    }
  });

  it("makes the behavioral lesson XP only while keeping ordinary correlation and quantitative lessons funded", () => {
    expect(lessonReward("correlation-not-causation")).toEqual({ practiceCapitalMinor: 0n, rewardPolicyVersion: 4 });
    for (const id of ["correlation-what-is-correlation", "correlation-real-data", "returns-log-returns"]) {
      expect(lessonReward(id)).toEqual({ practiceCapitalMinor: 200_000n, rewardPolicyVersion: 4 });
    }
  });

  it("requires a curriculum placement before a planned lesson can receive a reward", () => {
    for (const lesson of curriculumLessons.filter((entry) => entry.status === "planned")) {
      expect(() => lessonReward(lesson.id)).toThrow(/curriculum placement/i);
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
      // This lesson moved to B8. Its v3 receipt still contributes the full stored amount.
      { lessonId: "correlation-not-causation", practiceCapitalMinor: 200_000n, rewardPolicyVersion: MODULE_REWARD_POLICY_VERSION },
      { lessonId: foundations[0].id, ...lessonReward(foundations[0].id) },
      { lessonId: beyondFoundations[0].id, ...lessonReward(beyondFoundations[0].id) },
    ];
    const before = structuredClone(awards);
    // 2,000 (v1) + 0 (v2) + 2,000 (v3 B8) + 0 (v4 L1) + 2,000 (v4 L3) + 5,000 (unlock).
    expect(getPracticeCapitalSummary(awards, [500_000n])).toEqual({ earnedPracticeCapitalMinor: 1_100_000n });
    expect(getPracticeCapitalSummary(awards, [500_000n])).toEqual({ earnedPracticeCapitalMinor: 1_100_000n });
    expect(awards).toEqual(before);
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
