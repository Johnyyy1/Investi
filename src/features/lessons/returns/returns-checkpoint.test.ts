import { describe, expect, it } from "vitest";
import { consecutiveSimpleReturns, cumulativeReturn, logReturn, recoveryReturn, simpleReturn, simpleReturnFromLog } from "@/features/finance/returns";
import { getModuleBySlug } from "@/features/learning/catalog";
import { validateCompletion, validateMove } from "@/features/progress/transition";
import { lessonReward, LESSON_PRACTICE_CAPITAL_MINOR, REWARD_POLICY_VERSION } from "@/features/rewards/practice-capital";
import { block, correctAnswers, numericAnswer, wrongAnswers } from "../lesson-test-support";
import { evaluateQuestion, isQuestion } from "../question-evaluation";
import { getGuidedSteps } from "../steps";
import { logReturnsLesson } from "./log-returns";
import { returnsLessons } from "./manifest";
import { returnsCheckpointLesson as lesson } from "./returns-checkpoint";

const prices = [200, 250, 200, 240];

describe("Returns checkpoint", () => {
  it("closes the Returns module as its sixth published lesson", () => {
    expect(returnsLessons[5]).toMatchObject({ id: "returns-checkpoint", status: "available" });
    expect(getModuleBySlug("returns")).toMatchObject({ lessonCount: 6, estimatedMinutes: 75 });
    expect(logReturnsLesson.navigation?.next?.href).toBe("/learn/returns/returns-checkpoint");
    expect(lesson.navigation).toEqual({ previous: { href: "/learn/returns/log-returns", label: returnsLessons[4].title } });
    expect(lessonReward(lesson.id)).toEqual({ practiceCapitalMinor: LESSON_PRACTICE_CAPITAL_MINOR, rewardPolicyVersion: REWARD_POLICY_VERSION });
  });

  it("opens with a question, gates every question step and completes only from the last step", () => {
    const steps = getGuidedSteps(lesson);
    expect(steps[0].blocks.some(isQuestion)).toBe(true);
    expect(steps.flatMap((step) => step.blocks.map((item) => item.id)).sort()).toEqual(lesson.blocks.map((item) => item.id).sort());
    for (const [index, step] of steps.entries()) {
      for (const item of step.blocks) if ("title" in item) expect(item.title).not.toBe(step.title);
      const question = step.blocks.find(isQuestion);
      if (!question) continue;
      expect(evaluateQuestion(question, wrongAnswers(question))).toBe(false);
      expect(() => validateMove(lesson.id, index, index + 1, wrongAnswers(question))).toThrow();
      expect(() => validateMove(lesson.id, index, index + 1, correctAnswers(question))).not.toThrow();
    }
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: steps.length - 2 })).toThrow();
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: steps.length - 1 })).not.toThrow();
  });

  it("uses the canonical return functions for every answer", () => {
    expect(simpleReturn(400, 440)).toBeCloseTo(0.1, 12);
    expect(simpleReturn(150, 180)).toBeCloseTo(0.2, 12);
    const periods = consecutiveSimpleReturns(prices);
    const authored = block(lesson, "period-check", "multiNumericQuestion").answers.map((answer) => answer.answer / 100);
    periods.forEach((value, index) => expect(value).toBeCloseTo(authored[index], 12));
    expect(numericAnswer(lesson, "cumulative-check") / 100).toBeCloseTo(cumulativeReturn(periods), 12);
    // Adding the period returns gives 25 %, which the tolerance rejects.
    expect(evaluateQuestion(block(lesson, "cumulative-check", "numericQuestion"), { answer: "25" })).toBe(false);
    expect(numericAnswer(lesson, "recovery-check") / 100).toBeCloseTo(recoveryReturn(0.2), 12);
    expect(numericAnswer(lesson, "total-check") / 100).toBeCloseTo((240 - 200 + 6) / 200, 12);
    const logSum = periods.reduce((sum, _, index) => sum + logReturn(prices[index], prices[index + 1]), 0);
    expect(logSum * 100).toBeCloseTo(18.23, 2);
    expect(simpleReturnFromLog(logSum)).toBeCloseTo(0.2, 12);
  });
});
