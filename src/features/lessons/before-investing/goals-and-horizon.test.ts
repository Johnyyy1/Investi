import { describe, expect, it } from "vitest";
import { getAuthoredLesson } from "../registry";
import { getGuidedSteps } from "../steps";
import { correctAnswers, wrongAnswers } from "../answer-keys";
import { isQuestion } from "../question-evaluation";
import { validateMove, validateCompletion } from "@/features/progress/transition";
import { getLessonPlacement } from "@/features/learning/curriculum";
import { lessonReward } from "@/features/rewards/practice-capital";
import { artifactPayloadSchemas } from "@/features/artifacts/schemas";
import { artifactExamples } from "@/features/artifacts/test-fixtures";
import { ipsGoalSchema } from "@/features/ips/schema";
import { goalsAndHorizonLesson as lesson } from "./goals-and-horizon";
import { emptyGoal, goalMapFromDraft, goalDraftsFromMap, goalsForIps, horizonCategory } from "./goals-model";

const steps = getGuidedSteps(lesson);
describe("goals and horizon lesson 0.1.4", () => {
  it("publishes its stable identity, route and recommended prerequisite without changing reward policy", () => {
    expect(getAuthoredLesson("before-investing", "goals-and-horizon")).toBe(lesson);
    expect(lesson.id).toBe("before-investing-goals");
    expect(getLessonPlacement(lesson.id)).toMatchObject({ displayCode: "0.1.4", required: "recommended", prerequisites: ["before-investing-budget"] });
    expect(lessonReward(lesson.id)).toMatchObject({ practiceCapitalMinor: 0n, rewardPolicyVersion: 4 });
    expect(steps.find((step) => step.blocks.some((block) => block.id === "map"))?.requiredArtifact).toEqual({ kind: "goal_map" });
  });
  it("covers each block once, re-evaluates every question and keeps the final step ungraded", () => {
    expect(steps.flatMap((step) => step.blocks.map((block) => block.id)).sort()).toEqual(lesson.blocks.map((block) => block.id).sort());
    expect(new Set(lesson.blocks.map((block) => block.id)).size).toBe(lesson.blocks.length);
    steps.forEach((step, index) => {
      const questions = step.blocks.filter(isQuestion);
      expect(questions.length).toBeLessThanOrEqual(1);
      if (questions[0]) {
        expect(step.blocks.at(-1)).toBe(questions[0]);
        expect(() => validateMove(lesson.id, index, index + 1, wrongAnswers(questions[0]))).toThrow();
        expect(() => validateMove(lesson.id, index, index + 1, correctAnswers(questions[0]))).not.toThrow();
      }
    });
    expect(steps.at(-1)!.blocks.some(isQuestion)).toBe(false);
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: steps.length - 2 })).toThrow();
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: steps.length - 1 })).not.toThrow();
  });
  it("checks both inclusive horizon boundaries and recomputes the simulated loss/recovery", () => {
    expect([8, 36, 37, 84, 85, 420].map(horizonCategory)).toEqual(["Do 3 let včetně", "Do 3 let včetně", "Nad 3 až 7 let včetně", "Nad 3 až 7 let včetně", "Nad 7 let", "Nad 7 let"]);
    const example = lesson.blocks.find((block) => block.id === "risk");
    if (example?.type !== "workedExample") throw new Error("Missing example");
    const start = 300000;
    const remaining = start * (1 - 30 / 100);
    expect(example.steps.map((step) => step.value)).toEqual([`${start.toLocaleString("cs-CZ").replaceAll("\u00a0", " ")} Kč`, `${remaining.toLocaleString("cs-CZ").replaceAll("\u00a0", " ")} Kč`, `${(start - remaining).toLocaleString("cs-CZ").replaceAll("\u00a0", " ")} Kč`, `${((start / remaining - 1) * 100).toFixed(1).replace(".", ",")} % k návratu`]);
    expect(lesson.blocks.some((block) => block.type === "numericQuestion" || block.type === "multiNumericQuestion")).toBe(false);
  });
});

describe("goal map payload compatibility and exact amounts", () => {
  const goal = { ...emptyGoal(), label: "Bydlení", year: "2033" };
  it.each([["0,1", "10"], ["0.25", "25"], ["300000", "30000000"], ["9999999999999,99", "999999999999999"]])("stores %s Kč as %s minor units", (amount, amountMinor) => {
    const map = goalMapFromDraft([{ ...goal, amount }], false, 2026);
    expect(map.goals[0]).toMatchObject({ amountMinor, targetYear: 2033, horizonMonths: 7 * 12 });
    expect(goalMapFromDraft(goalDraftsFromMap(map, 2026), false, 2026)).toEqual(map);
  });
  it.each(["1,3333", "-1", "1e3", "NaN", "10000000000000"])("rejects rather than rounding or losing %s", (amount) => {
    expect(() => goalMapFromDraft([{ ...goal, amount }], false, 2026)).toThrow();
  });
  it("preserves old maps and strips new metadata at the strict IPS boundary", () => {
    expect(artifactPayloadSchemas.goal_map.parse(artifactExamples.goal_map)).toEqual(artifactExamples.goal_map);
    const map = goalMapFromDraft([{ ...goal, amount: "0,25" }], false, 2026);
    expect(goalsForIps(map)?.every((entry) => ipsGoalSchema.safeParse(entry).success)).toBe(true);
    expect(goalsForIps(map)?.[0]).not.toHaveProperty("amountMinor");
    expect(artifactPayloadSchemas.goal_map.safeParse({ goals: Array(10).fill(artifactExamples.goal_map.goals[0]) }).success).toBe(true);
  });
  it("requires either real entries or an explicit empty choice, never both or a fabricated placeholder", () => {
    const skipped = goalMapFromDraft([], true, 2026);
    expect(artifactPayloadSchemas.goal_map.parse(skipped)).toEqual({ goals: [], noSpecificGoal: true });
    expect(goalsForIps(skipped)).toBeUndefined();
    for (const invalid of [{ goals: [] }, { goals: [], noSpecificGoal: false }, { ...artifactExamples.goal_map, noSpecificGoal: true }]) expect(artifactPayloadSchemas.goal_map.safeParse(invalid).success).toBe(false);
    expect(() => goalMapFromDraft([], false, 2026)).toThrow();
    expect(() => goalMapFromDraft([{ ...goal, label: " " }], false, 2026)).toThrow();
    for (const year of ["2025", "2127", "2026.5", "2e3", ""]) expect(() => goalMapFromDraft([{ ...goal, year }], false, 2026)).toThrow();
    expect(goalMapFromDraft([{ ...goal, year: "2026" }], false, 2026).goals[0].horizonMonths).toBe(1);
    expect(goalMapFromDraft([goal], false, 2026).goals[0]).not.toHaveProperty("amountMinor");
  });
});
