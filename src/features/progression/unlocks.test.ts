import { describe, expect, it, vi } from "vitest";
import { evaluateUnlock, PORTFOLIO_LAB_UNLOCK_ID, progressionUnlocks, resolvePortfolioLabUnlock } from "./unlocks";

const required = progressionUnlocks.PORTFOLIO_LAB.prerequisiteLessonIds;
const status = (xp: number, lessons: string[], persisted = false) => evaluateUnlock(PORTFOLIO_LAB_UNLOCK_ID, { totalXp: xp, completedLessonIds: new Set(lessons) }, persisted);

describe("Portfolio Lab unlock", () => {
  it("requires XP and the original seven Foundations lessons", () => {
    expect(status(0, []).unlocked).toBe(false);
    expect(status(420, required.slice(0, -1)).unlocked).toBe(false);
    expect(status(360, [...required]).unlocked).toBe(false);
    expect(status(420, [...required]).unlocked).toBe(true);
  });
  it("keeps the original requirements when three more Foundations lessons are published", async () => {
    vi.resetModules();
    vi.doMock("@/features/lessons/foundations/manifest", async (importActual) => {
      const manifest = await importActual<typeof import("@/features/lessons/foundations/manifest")>();
      return { ...manifest, foundationsLessons: [
        ...manifest.foundationsLessons.map((lesson) => ({ ...lesson, status: "available" })),
        { id: "foundations-expansion-8", status: "available" },
        { id: "foundations-expansion-9", status: "available" },
      ] };
    });
    try {
      const { evaluateUnlock: expanded, progressionUnlocks: definitions } = await import("./unlocks");
      expect(definitions.PORTFOLIO_LAB.prerequisiteLessonIds).toEqual([
        "foundations-why-invest", "foundations-stocks", "foundations-etfs-indexes", "foundations-bonds-cash",
        "foundations-markets", "foundations-risk-reward", "foundations-portfolio",
      ]);
      expect(expanded(PORTFOLIO_LAB_UNLOCK_ID, { totalXp: 420, completedLessonIds: new Set(required) })).toMatchObject({
        unlocked: true, prerequisitesComplete: true, requiredPrerequisiteLessons: 7,
      });
      expect(expanded(PORTFOLIO_LAB_UNLOCK_ID, { totalXp: 0, completedLessonIds: new Set() }, true).unlocked).toBe(true);
      expect(expanded(PORTFOLIO_LAB_UNLOCK_ID, { totalXp: 600, completedLessonIds: new Set([...required.slice(0, -1), "foundations-checkpoint", "foundations-expansion-8", "foundations-expansion-9"]) }).unlocked).toBe(false);
    } finally {
      vi.doUnmock("@/features/lessons/foundations/manifest");
      vi.resetModules();
    }
  });
  it("keeps Checkpoint 1 and future L1 lessons outside the Lab prerequisite", () => {
    expect(required).toEqual([
      "foundations-why-invest", "foundations-stocks", "foundations-etfs-indexes", "foundations-bonds-cash",
      "foundations-markets", "foundations-risk-reward", "foundations-portfolio",
    ]);
    expect(status(420, [...required]).unlocked).toBe(true);
    expect(status(420, [...required.slice(0, -1), "foundations-checkpoint"]).unlocked).toBe(false);
  });
  it("recognizes a recorded entitlement for existing users without fabricating XP", () => {
    const result = status(0, [], true);
    expect(result.unlocked).toBe(true);
    expect(result.totalXp).toBe(0);
  });
  it("opens the demo without completing lessons or fabricating XP", () => {
    const result = evaluateUnlock(PORTFOLIO_LAB_UNLOCK_ID, { totalXp: 360, completedLessonIds: new Set(required.slice(0, 5)) }, false, true);
    expect(result.unlocked).toBe(true);
    expect(result.totalXp).toBe(360);
    expect(result.completedPrerequisiteLessons).toBe(5);
    expect(result.prerequisitesComplete).toBe(false);
    expect(status(360, [...required.slice(0, 5)]).unlocked).toBe(false);
  });
  it("uses the existing 60 XP receipt scale and exact minor units", () => {
    expect(required).toHaveLength(7);
    expect(progressionUnlocks.PORTFOLIO_LAB.xpRequired).toBe(required.length * 60);
    expect(progressionUnlocks.PORTFOLIO_LAB.rewardPracticeCapitalMinor).toBe(500_000n);
  });
});

describe("Portfolio Lab unlock read/write split", () => {
  const facts = (xp: number, lessons: readonly string[], flags: { recorded?: boolean; grandfathered?: boolean; isDemo?: boolean } = {}) =>
    resolvePortfolioLabUnlock({ progression: { totalXp: xp, completedLessonIds: new Set(lessons) }, recorded: false, grandfathered: false, isDemo: false, ...flags });

  it("answers a recorded unlock from the read alone, even if the learning facts no longer qualify", () => {
    expect(facts(420, required, { recorded: true })).toMatchObject({ needsRecord: false, status: { unlocked: true } });
    expect(facts(0, [], { recorded: true })).toMatchObject({ needsRecord: false, status: { unlocked: true, totalXp: 0 } });
    expect(facts(0, [], { recorded: true, isDemo: true, grandfathered: true })).toMatchObject({ needsRecord: false, status: { unlocked: true } });
  });
  it("answers a locked account from the read alone", () => {
    expect(facts(0, [])).toMatchObject({ needsRecord: false, status: { unlocked: false, completedPrerequisiteLessons: 0 } });
    expect(facts(360, required.slice(0, 6))).toMatchObject({ needsRecord: false, status: { unlocked: false, completedPrerequisiteLessons: 6 } });
    expect(facts(480, required.slice(0, 6))).toMatchObject({ needsRecord: false, status: { unlocked: false } });
  });
  it("sends every unrecorded unlock to the locked write path", () => {
    expect(facts(420, required)).toMatchObject({ needsRecord: true, status: { unlocked: true, prerequisitesComplete: true } });
    expect(facts(0, [], { isDemo: true })).toMatchObject({ needsRecord: true, status: { unlocked: true, prerequisitesComplete: false } });
    expect(facts(0, [], { grandfathered: true })).toMatchObject({ needsRecord: true, status: { unlocked: true, totalXp: 0 } });
  });
});
