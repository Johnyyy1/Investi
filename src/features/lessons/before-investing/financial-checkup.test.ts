import { describe, expect, it } from "vitest";
import { financialCheckupLesson as lesson } from "./financial-checkup";
import { checkupNextStep, type FinancialCheckup } from "./checkup-model";
import { artifactPayloadSchemas } from "@/features/artifacts/schemas";
import { recommendLearning } from "@/features/personalization/recommendation";
import { getLessonPlacement } from "@/features/learning/curriculum";
import { getGuidedSteps } from "../steps";
import { isQuestion, evaluateQuestion } from "../question-evaluation";
import { correctAnswers, wrongAnswers } from "../answer-keys";
import { validateMove } from "@/features/progress/transition";
import { lessonReward } from "@/features/rewards/practice-capital";

const ready: FinancialCheckup = { reserve: "ready_for_goal", expensiveDebt: "none", budget: "reviewed", goals: "defined", retirement: "reviewed", nextStep: "continue_learning" };
describe("financial check-up 0.1.7", () => {
  it("gives deterministic priorities and never trusts the declared next step", () => {
    expect(checkupNextStep(ready)).toBe("continue_learning");
    expect(checkupNextStep({ ...ready, expensiveDebt: "plan_needed", reserve: "building", budget: "needs_review" })).toBe("make_debt_plan");
    for (const reserve of ["building", "needs_review"] as const) expect(checkupNextStep({ ...ready, reserve })).toBe("build_reserve");
    expect(checkupNextStep({ ...ready, budget: "needs_review" })).toBe("review_budget");
    expect(checkupNextStep({ ...ready, goals: "needs_review" })).toBe("define_goals");
    expect(checkupNextStep({ ...ready, retirement: "unknown" })).toBe("continue_learning");
  });
  it("preserves old payloads, supports private choices, and rejects personal amounts", () => {
    const { goals, retirement, ...old } = ready;
    expect(goals).toBe("defined"); expect(retirement).toBe("reviewed");
    expect(artifactPayloadSchemas.financial_checkup.parse(old)).toEqual(old);
    expect(artifactPayloadSchemas.financial_checkup.parse({ budget: "prefer_not_to_say", expensiveDebt: "prefer_not_to_say", reserve: "prefer_not_to_say", goals: "prefer_not_to_say", retirement: "prefer_not_to_say", nextStep: "review_budget" })).toBeDefined();
    for (const key of ["income", "debtAmount", "accountNumber"]) expect(artifactPayloadSchemas.financial_checkup.safeParse({ ...ready, [key]: "123" }).success).toBe(false);
  });
  it("changes study advice, supports review, and does not modify progress or entitlements", () => {
    const progress = [{ lessonId: "before-investing-debt", status: "completed" }];
    const input = { financialCheckup: { ...ready, expensiveDebt: "plan_needed" as const }, progress };
    expect(recommendLearning(input)).toMatchObject({ nextLessonId: "before-investing-debt", reasonCode: "CHECKUP_READINESS", sessionLessonIds: ["before-investing-debt"] });
    expect(recommendLearning(input)).toEqual(recommendLearning(input));
    expect(progress).toEqual([{ lessonId: "before-investing-debt", status: "completed" }]);
    expect(recommendLearning({ financialCheckup: { ...ready, reserve: "building" } })).toMatchObject({ nextLessonId: lesson.id, reasonCode: "CHECKUP_READINESS" });
    expect(recommendLearning({ financialCheckup: ready })).toEqual(recommendLearning());
    expect(lessonReward(lesson.id).practiceCapitalMinor).toBe(0n);
    expect(getLessonPlacement(lesson.id)).toMatchObject({ displayCode: "0.1.7", required: "recommended" });
  });
  it("recomputes both numeric answers from the model inputs", () => {
    const expected = { budget: { answer: (42000 - 35700) / 42000 * 100, tolerance: 0.01 }, "real-return": { answer: Math.round((1.04 / 1.03 - 1) * 10000) / 100, tolerance: 0.005 } };
    const questions = lesson.blocks.filter((block) => block.type === "numericQuestion");
    expect(questions).toHaveLength(Object.keys(expected).length);
    for (const question of questions) {
      expect(question).toMatchObject(expected[question.id as keyof typeof expected]);
      expect(evaluateQuestion(question, correctAnswers(question, { decimalComma: true }))).toBe(true);
      expect(evaluateQuestion(question, wrongAnswers(question))).toBe(false);
    }
  });
  it("requires the ungraded saved artifact, one question per step and no final question", () => {
    const steps = getGuidedSteps(lesson);
    expect(steps[0].requiredArtifact).toEqual({ kind: "financial_checkup" });
    expect(steps.flatMap((step) => step.blocks.map((block) => block.id)).sort()).toEqual(lesson.blocks.map((block) => block.id).sort());
    for (const [index, step] of steps.entries()) {
      const questions = step.blocks.filter(isQuestion);
      expect(questions.length).toBeLessThanOrEqual(1);
      if (questions.length) {
        expect(() => validateMove(lesson.id, index, index + 1, wrongAnswers(questions[0]))).toThrow();
        expect(() => validateMove(lesson.id, index, index + 1, correctAnswers(questions[0]))).not.toThrow();
        expect(questions[0]).toHaveProperty("reviewHref");
      }
    }
    expect(steps.at(-1)!.blocks.some(isQuestion)).toBe(false);
  });
});
