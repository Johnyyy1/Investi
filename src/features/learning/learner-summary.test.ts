import { describe, expect, it } from "vitest";
import { getLearnerSummary, type LearnerState } from "./learner-summary";
import { availableLessons, curriculumLessons, getModulePath } from "./catalog";
const row = (id: string, status: LearnerState["status"], day = 1, lastPosition = 3): LearnerState => ({ lessonId: id, status, lastPosition, updatedAt: new Date(2026, 8, day), completedAt: status === "completed" ? new Date(2026, 8, day) : null });
describe("real learner summary", () => {
  it("starts at the recommended implemented module", () => {
    expect(getLearnerSummary([]).next.id).toBe("foundations-why-invest");
    expect(getLearnerSummary([], "returns").next.id).toBe("returns-what-is-a-return");
    expect(getLearnerSummary([]).percentage).toBe(0);
    expect(getLearnerSummary([]).recent).toEqual([]);
  });
  it("prioritizes active Returns over a beginner recommendation", () => {
    expect(getLearnerSummary([row("returns-simple-returns", "in_progress")]).next.id).toBe("returns-simple-returns");
  });
  it("uses recency across modules and clamps the cursor", () => {
    const states = [row("returns-compounding", "in_progress", 1), row("foundations-stocks", "in_progress", 2, 999)];
    const summary = getLearnerSummary(states);
    expect(summary.next.id).toBe("foundations-stocks");
    expect(summary.position).toBe(summary.stepCount - 1);
    expect(states[0].lessonId).toBe("returns-compounding");
  });
  it("breaks equal timestamps in curriculum order", () => {
    expect(getLearnerSummary([row("returns-compounding", "in_progress"), row("foundations-stocks", "in_progress")]).next.id).toBe("foundations-stocks");
  });
  it("continues a module after completion even if the recommendation changed", () => {
    const summary = getLearnerSummary([row("returns-what-is-a-return", "completed")]);
    expect(summary.next.id).toBe("returns-simple-returns");
    expect(summary.percentage).toBe(6);
    expect(getLearnerSummary([row("foundations-why-invest", "completed")], "returns").next.id).toBe("foundations-stocks");
  });
  it("moves to Returns when all available Foundations lessons are completed", () => {
    expect(getLearnerSummary(availableLessons.filter((lesson) => lesson.moduleSlug === "investing-foundations").map((lesson) => row(lesson.id, "completed"))).next.id).toBe("returns-what-is-a-return");
  });
  it("continues from comparison into log returns, then completes without a planned route", () => {
    const prior = availableLessons.filter((lesson) => lesson.id !== "returns-log-returns").map((lesson) => row(lesson.id, "completed"));
    const summary = getLearnerSummary(prior);
    expect(summary.allComplete).toBe(false);
    expect(summary.next.id).toBe("returns-log-returns");
    expect(getLearnerSummary([...prior, row("returns-log-returns", "completed")]).allComplete).toBe(true);
  });
  it("counts only implemented learning and offers review when all seventeen are complete", () => {
    const summary = getLearnerSummary(curriculumLessons.map((lesson) => row(lesson.id, "completed")));
    expect(summary.percentage).toBe(100);
    expect(summary.allComplete).toBe(true);
    expect(summary.completed).toHaveLength(17);
    expect(summary.recent).toHaveLength(17);
  });
  it("ignores unknown/planned progress and never unlocks upcoming lessons", () => {
    const states = [row("foundations-checkpoint", "completed"), row("unknown", "in_progress")];
    expect(getLearnerSummary(states).completed).toEqual([]);
    expect(getLearnerSummary(states).next.id).toBe("foundations-why-invest");
    const path = getModulePath("investing-foundations", states);
    expect(path).toHaveLength(8);
    expect(path.slice(7).every((item) => item.state === "locked")).toBe(true);
  });
});
