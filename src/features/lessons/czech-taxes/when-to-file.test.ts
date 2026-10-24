import { describe, expect, it } from "vitest";
import { whenToFileLesson as lesson } from "./when-to-file";
import { authoredLessons, draftLessons, getAuthoredLesson } from "../registry";
import { getGuidedSteps } from "../steps";
import { block, correctAnswers, wrongAnswers } from "../lesson-test-support";
import { isQuestion, evaluateQuestion } from "../question-evaluation";
import { resolveDecisionTree } from "../decision-tree";
import { validateMove, validateStepMove } from "@/features/progress/transition";
import { curriculumLessons, availableLessons, moduleCatalog } from "@/features/learning/catalog";
import { getLessonPlacement } from "@/features/learning/curriculum";
import { lessonReward } from "@/features/rewards/practice-capital";
import { factRegistry } from "@/features/facts/registry";
import { resolveFact } from "@/features/facts/resolve";
import { prepareLessonFacts } from "@/features/facts/lesson-facts";
import { checkPublishedFacts } from "@/features/facts/check-published";

const today = "2026-10-24";
const prepared = prepareLessonFacts(lesson, factRegistry, { today, published: false });
const steps = getGuidedSteps(prepared.lesson);

describe("tax filing lesson 2.4.1", () => {
  it("reserves stable identity and L2 placement while keeping the draft unavailable", () => {
    expect(curriculumLessons.find((entry) => entry.id === lesson.id)).toMatchObject({ id: "taxes-filing-obligation", moduleId: "module-czech-taxes", moduleSlug: "czech-taxes", slug: "when-to-file", status: "planned" });
    expect(moduleCatalog.find((entry) => entry.slug === lesson.moduleSlug)?.status).toBe("planned");
    expect(draftLessons).toContain(lesson);
    expect(authoredLessons).not.toContain(lesson);
    expect(availableLessons.some((entry) => entry.id === lesson.id)).toBe(false);
    expect(getAuthoredLesson("czech-taxes", "when-to-file")).toBeUndefined();
    expect(() => validateMove(lesson.id, 0, 1, { answer: "classify" })).toThrow(/unavailable/);
    expect(getLessonPlacement(lesson.id)).toMatchObject({ displayCode: "2.4.1", prerequisites: ["foundations-stocks"], required: "required", skills: ["tax-filing"] });
    expect(lessonReward(lesson.id)).toEqual({ practiceCapitalMinor: 200000n, rewardPolicyVersion: 4 });
  });

  it("covers every block exactly once and requires correct answers before continuing", () => {
    expect(steps.flatMap((step) => step.blocks.map((entry) => entry.id)).sort()).toEqual(lesson.blocks.map((entry) => entry.id).sort());
    expect(new Set(lesson.blocks.map((entry) => entry.id)).size).toBe(lesson.blocks.length);
    for (let index = 0; index < steps.length - 1; index++) {
      const questions = steps[index].blocks.filter(isQuestion);
      expect(questions.length).toBeLessThanOrEqual(1);
      if (questions[0]) {
        expect(steps[index].blocks.at(-1)).toBe(questions[0]);
        expect(() => validateStepMove(steps, index, index + 1, wrongAnswers(questions[0]))).toThrow(/correctly/);
        expect(() => validateStepMove(steps, index, index + 1, correctAnswers(questions[0]))).not.toThrow();
      } else expect(() => validateStepMove(steps, index, index + 1)).not.toThrow();
    }
    expect(steps.at(-1)!.blocks.some(isQuestion)).toBe(false);
  });

  it("recomputes persona C and compares proceeds, holding period and both relevant limits", () => {
    const input = { purchase: 120000, proceeds: 150000, bought: "2025-06-15", sold: "2026-06-15" };
    const amounts = block(lesson, "student-amounts", "multiNumericQuestion");
    expect(amounts.answers.map((field) => [field.answer, field.tolerance])).toEqual([[input.proceeds, 0], [input.proceeds - input.purchase, 0]]);
    const rules = String(resolveFact("dan.hranice_priznani", today, factRegistry).value.amount).replaceAll(" ", "");
    const filingLimit = Number(rules.match(/nad(\d+)Kč/)![1]);
    const exemptionLimit = resolveFact("dan.limit_100k", today, factRegistry).value.amount;
    const holdingYears = resolveFact("dan.casovy_test_cp", today, factRegistry).value.amount;
    expect(input.proceeds).toBeGreaterThan(Number(exemptionLimit));
    expect(new Date(input.sold).getUTCFullYear() - new Date(input.bought).getUTCFullYear()).toBeLessThan(Number(holdingYears));
    expect(input.proceeds).toBeGreaterThan(filingLimit);
    expect(input.proceeds - input.purchase).toBeLessThan(filingLimit);
    expect(evaluateQuestion(amounts, { proceeds: String(input.proceeds - input.purchase), gain: String(input.proceeds) })).toBe(false);
    expect(block(lesson, "persona-c", "multipleChoiceQuestion").correctOptionId).toBe("yes");
    const inputText = block(lesson, "student-inputs", "paragraph").content;
    for (const value of [input.purchase, input.proceeds]) expect(inputText).toContain(value.toLocaleString("cs-CZ").replaceAll(" ", " "));
    expect(inputText).toContain("15. 6. 2025");
    expect(inputText).toContain("15. 6. 2026");
  });

  it("keeps the persona answers tied to their income regimes", () => {
    const rules = String(resolveFact("dan.hranice_priznani", today, factRegistry).value.amount).replaceAll(" ", "");
    const employeeLimit = Number(rules.match(/§7–10nad(\d+)Kč/)![1]);
    expect(25000).toBeGreaterThan(employeeLimit);
    expect(4000).toBeLessThanOrEqual(employeeLimit);
    expect(block(lesson, "persona-a", "multipleChoiceQuestion").correctOptionId).toBe("yes");
    expect(block(lesson, "persona-b", "fadedExample").blank).toMatchObject({ correctOptionId: "no" });
    expect(block(lesson, "jana", "workedExample").steps.at(-1)?.value).toBe("4 000 Kč");
    expect(block(lesson, "loss-question", "multipleChoiceQuestion").correctOptionId).toBe("no");
  });

  it("routes loss, employee, nonemployee and unsupported cases without pretending to be a tax calculator", () => {
    const tree = block(lesson, "tree", "decisionTree");
    for (const path of [["yes"], ["no", "yes", "above"], ["no", "none", "above"]]) expect(resolveDecisionTree(tree, path)?.id).toBe("file");
    for (const path of [["no", "yes", "within"], ["no", "none", "within"]]) expect(resolveDecisionTree(tree, path)?.id).toBe("no-filing");
    expect(resolveDecisionTree(tree, ["no", "unclear"])?.id).toBe("verify");
    expect(resolveDecisionTree(tree, ["invented"])).toBeUndefined();
  });

  it("resolves all tax tokens but refuses publication and an invented verification date", () => {
    expect(JSON.stringify(prepared.lesson)).not.toContain("{{");
    expect(prepared.facts.map((fact) => fact.key).sort()).toEqual(["dan.casovy_test_cp", "dan.dividendy_cz", "dan.hranice_priznani", "dan.lhuty_priznani", "dan.limit_100k", "dan.oznameni_5m"]);
    expect(prepared.notice).toBeUndefined(); // No complete verification date exists for this draft.
    expect(() => prepareLessonFacts(lesson, factRegistry, { today, published: true })).toThrow(/blocked/);
    // Even future fact verification alone must not bypass the tax-adviser review gate.
    const verified = factRegistry.map((fact) => ({ ...fact, verificationStatus: "primary" as const, publicationBlockedBy: undefined, verifiedAt: today, checkedAt: today, nextReviewAt: "2027-01-15" }));
    expect(() => checkPublishedFacts(verified, [lesson], [{ id: lesson.id, status: "available" }], today, [])).toThrow(/no expert review approval/);
    expect(block(lesson, "deadlines", "explanation").content).not.toMatch(/1\. 4\.|4\. 5\.|1\. 7\./);
  });
});
