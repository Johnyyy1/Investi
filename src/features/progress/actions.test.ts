import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), complete: vi.fn(), start: vi.fn(), save: vi.fn(), count: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("./repository", () => ({ completeLesson: mocks.complete, markLessonInProgress: mocks.start, saveLessonProgress: mocks.save, getModuleProgress: mocks.count }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { completeLessonAction, markLessonStartedAction, saveLessonPositionAction } from "./actions";
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
  it.each(["foundations-checkpoint", "returns-checkpoint", "unknown"])("rejects writes to %s", async (id) => {
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
});
