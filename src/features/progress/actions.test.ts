import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), complete: vi.fn(), start: vi.fn(), save: vi.fn(), count: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("./repository", () => ({ completeLesson: mocks.complete, markLessonInProgress: mocks.start, saveLessonProgress: mocks.save, getModuleProgress: mocks.count }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { completeLessonAction, markLessonStartedAction, saveLessonPositionAction } from "./actions";
import { ArtifactRequiredError } from "@/features/artifacts/requirements";
describe("shared persisted lesson actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "session-owner" });
    mocks.count.mockResolvedValue(2);
    mocks.complete.mockResolvedValue({
      xpAwarded: 60,
      totalXp: 360,
      portfolioLabUnlocked: false,
      unlockCapitalAwardedMinor: 0n,
      lessonXp: 60,
      practiceCapitalAwardedMinor: BigInt(0),
      earnedPracticeCapitalMinor: BigInt(0),
      gamification: { totalXp: 360, streak: 4, todayCompleted: 1, dailyTarget: 2, timeZone: "Europe/Prague" },
      nextHref: "/learn/next",
      nextTitle: "Next lesson",
      allComplete: false,
    });
  });
  it.each([["foundations-stocks", "module-investing-foundations"], ["foundations-bonds-cash", "module-investing-foundations"], ["foundations-markets", "module-investing-foundations"], ["foundations-risk-reward", "module-investing-foundations"], ["foundations-portfolio", "module-investing-foundations"], ["returns-compounding", "module-returns"], ["returns-log-returns", "module-returns"]])("counts the correct module for %s", async (id, moduleId) => {
    expect(await completeLessonAction(id)).toMatchObject({ ok: true, completedLessons: 2 });
    expect(mocks.complete).toHaveBeenCalledWith("session-owner", id);
    expect(mocks.count).toHaveBeenCalledWith("session-owner", moduleId);
    expect(mocks.revalidate).toHaveBeenCalledWith("/learn", "layout");
  });
  it("serializes XP-only lesson rewards separately from unlock capital", async () => {
    const result = await completeLessonAction("foundations-stocks");
    expect(result).toMatchObject({
      ok: true,
      reward: {
        practiceCapitalAwardedMinor: "0",
        earnedPracticeCapitalMinor: "0",
        xpAwarded: 60,
        totalXp: 360,
        unlockCapitalAwardedMinor: "0",
        learningMomentum: { streak: 4, todayCompleted: 1, dailyTarget: 2, timeZone: "Europe/Prague" },
      },
    });
    if (!("reward" in result) || !result.reward) throw new Error("Expected successful completion reward");
    expect(result.reward.learningMomentum).not.toHaveProperty("totalXp");
  });
  it("never accepts a client XP amount", async () => {
    const result = await completeLessonAction("foundations-stocks");
    expect(result).toMatchObject({ ok: true, reward: { xpAwarded: 60 } });
    expect(mocks.complete).toHaveBeenCalledWith("session-owner", "foundations-stocks");
  });
  it.each(["foundations-checkpoint", "unknown"])("rejects writes to %s", async (id) => {
    expect(await markLessonStartedAction(id)).toMatchObject({ ok: false });
    expect(await saveLessonPositionAction(id, 1)).toMatchObject({ ok: false });
    expect(await completeLessonAction(id)).toMatchObject({ ok: false });
    expect(mocks.start).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("bounds the Foundations cursor on the server and saves only to the session owner", async () => {
    for (const position of [-1, 3, 1.5, Infinity]) expect(await saveLessonPositionAction("foundations-why-invest", position)).toMatchObject({ ok: false });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(await saveLessonPositionAction("foundations-why-invest", 2)).toEqual({ ok: true });
    expect(mocks.save).toHaveBeenCalledWith("session-owner", { lessonId: "foundations-why-invest", lastPosition: 2, status: "in_progress" }, undefined);
  });
  it("accepts every valid portfolio step and rejects a cursor past the final step", async () => {
    expect(await saveLessonPositionAction("foundations-portfolio", 7)).toEqual({ ok: true });
    expect(mocks.save).toHaveBeenCalledWith("session-owner", { lessonId: "foundations-portfolio", lastPosition: 7, status: "in_progress" }, undefined);
    expect(await saveLessonPositionAction("foundations-portfolio", 8)).toMatchObject({ ok: false });
  });
  it("rejects anonymous writes", async () => {
    mocks.user.mockResolvedValue(null);
    expect(await completeLessonAction("foundations-stocks")).toMatchObject({ ok: false });
    expect(await markLessonStartedAction("foundations-stocks")).toMatchObject({ ok: false });
    expect(await saveLessonPositionAction("foundations-stocks", 1)).toMatchObject({ ok: false });
    expect(mocks.complete).not.toHaveBeenCalled(); expect(mocks.start).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("reports persistence failure without returning successful completion", async () => {
    mocks.complete.mockRejectedValueOnce(new Error("offline"));
    expect(await completeLessonAction("foundations-stocks")).toMatchObject({ ok: false });
    expect(mocks.count).not.toHaveBeenCalled(); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("explains missing required outputs for both continuing and completing", async () => {
    mocks.save.mockRejectedValueOnce(new ArtifactRequiredError());
    mocks.complete.mockRejectedValueOnce(new ArtifactRequiredError());
    for (const result of [await saveLessonPositionAction("foundations-why-invest", 1), await completeLessonAction("foundations-why-invest")]) {
      expect(result).toMatchObject({ ok: false, message: "Nejdřív ulož výstup požadovaný v tomto kroku lekce." });
    }
  });
});

describe("progress action failure logging", () => {
  let log: MockInstance<typeof console.error>;
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "session-owner" });
    log = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  it("logs each unexpected failure once with the module prefix and keeps the learner message", async () => {
    const failure = new Error("lock timeout");
    mocks.start.mockRejectedValue(failure); mocks.complete.mockRejectedValue(failure); mocks.save.mockRejectedValue(failure);
    expect(await markLessonStartedAction("foundations-stocks")).toEqual({ ok: false, message: "Postup se nepodařilo uložit. Tvoje práce je na této stránce stále dostupná." });
    expect(await completeLessonAction("foundations-stocks")).toEqual({ ok: false, message: "Dokončení se nepodařilo uložit. Zkus to znovu." });
    expect(await saveLessonPositionAction("foundations-stocks", 1)).toEqual({ ok: false, message: "Tvé místo se nepodařilo uložit. Zkus to znovu." });
    expect(log.mock.calls).toEqual(["mark lesson started", "complete lesson", "save lesson position"].map((operation) => [`[progress] ${operation} failed`, { error: { name: "Error", message: "lock timeout" } }]));
  });

  it("does not log invalid input or a missing required lesson output", async () => {
    mocks.complete.mockRejectedValue(new ArtifactRequiredError()); mocks.save.mockRejectedValue(new ArtifactRequiredError());
    await markLessonStartedAction("not-a-lesson");
    await saveLessonPositionAction("foundations-stocks", 999);
    await saveLessonPositionAction("foundations-why-invest", 1);
    await completeLessonAction("foundations-why-invest");
    expect(log).not.toHaveBeenCalled();
  });
});
