import { describe, expect, it } from "vitest";
import { availableLessons } from "@/features/learning/catalog";
import { lessonSteps } from "@/features/progress/transition";
import { isQuestion, type QuestionBlock } from "./question-evaluation";
import publishedLessons from "./published-lessons-v1.json";
import revisions from "./published-lesson-revisions.json";
import { correctAnswers } from "./answer-keys";

// This is a historical compatibility fixture, not a snapshot to regenerate after a content edit.
// See docs/education/published-lesson-compatibility.md before changing a published contract.
function grading(question: QuestionBlock) {
  const { id } = question;
  if (question.type === "multipleChoiceQuestion") return { id, type: question.type, options: question.options.map((option) => option.id), correctOptionId: question.correctOptionId };
  if (question.type === "numericQuestion") return { id, type: question.type, answer: question.answer, tolerance: question.tolerance };
  if (question.type === "multiNumericQuestion") return { id, type: question.type, answers: question.answers.map(({ id, answer, tolerance }) => ({ id, answer, tolerance })) };
  // Step kinds added after v1 have no published contract yet; their answer key is the contract.
  return { id, type: question.type, answerKey: correctAnswers(question) };
}

type Contract = { id: string; moduleId: string; moduleSlug: string; slug: string; steps: { blocks: string[]; grading: ReturnType<typeof grading>[] }[] };
function currentContract(id: string): Contract {
  const { moduleId, moduleSlug, slug } = availableLessons.find((lesson) => lesson.id === id)!;
  return { id, moduleId, moduleSlug, slug, steps: lessonSteps(id).map((step) => ({
    blocks: step.blocks.map((block) => block.id), grading: step.blocks.filter(isQuestion).map(grading),
  })) };
}

function expectCompatible(original: Contract, current: Contract) {
  expect(current).toMatchObject({ id: original.id, moduleId: original.moduleId, moduleSlug: original.moduleSlug, slug: original.slug });
  const prefixLength = original.steps.length - 1;
  expect(current.steps.length).toBeGreaterThanOrEqual(original.steps.length);
  expect(current.steps.slice(0, prefixLength)).toEqual(original.steps.slice(0, prefixLength));
  expect(current.steps.at(-1)).toEqual(original.steps.at(-1));
  const revision = revisions.find((revision) => revision.lessonId === original.id);
  if (revision) {
    // An explicit identity cursor migration is safe only at the old, ungraded final boundary.
    expect(revision.previousFinalPosition).toBe(prefixLength);
    expect(revision.cursorMigration).toBe("identity");
    expect(current.steps.slice(prefixLength, -1)).toEqual(revision.insertedSteps);
  } else {
    for (const step of current.steps.slice(prefixLength, -1)) expect(step.grading).toEqual([]);
  }
  if (original.id.endsWith("-checkpoint")) expect(current.steps).toEqual(original.steps);
}

describe("published lesson compatibility (#119)", () => {
  it("records a compatibility contract for every published lesson", () => {
    const ids = new Set(publishedLessons.map((lesson) => lesson.id));
    expect(availableLessons.filter((lesson) => !ids.has(lesson.id)).map((lesson) => lesson.id)).toEqual([]);
  });
  it.each(publishedLessons)("preserves $id identity, URL, saved steps and grading", (original) => {
    // JSON contains a union of optional grading fields; the assertions compare their exact values.
    expectCompatible(original as Contract, currentContract(original.id));
  });
  it("allows explanatory steps only immediately before the final step", () => {
    const original = currentContract("foundations-why-invest");
    const current = structuredClone(original);
    current.steps.splice(-1, 0, { blocks: ["new-explanation"], grading: [] });
    expectCompatible(original, current);
  });
  it("freezes the explicitly versioned stocks extension without weakening its original contract", () => {
    const original = publishedLessons.find((lesson) => lesson.id === "foundations-stocks")! as Contract;
    const current = currentContract(original.id);
    expectCompatible(original, current);
    for (const edit of [
      (contract: Contract) => { contract.steps[6].grading = []; },
      (contract: Contract) => { contract.steps[6].grading[0] = { id: "position-czk", type: "numericQuestion", answer: 450, tolerance: 0.000001 }; },
      (contract: Contract) => { contract.steps.splice(5, 0, contract.steps[6]); },
      (contract: Contract) => { contract.steps.push({ blocks: ["after-summary"], grading: [] }); },
    ]) {
      const changed = structuredClone(current);
      edit(changed);
      expect(() => expectCompatible(original, changed)).toThrow();
    }
  });
  it("rejects cursor shifts, removed steps, changed block IDs, grading changes and new graded steps", () => {
    const original = currentContract("foundations-why-invest");
    const edits: ((contract: Contract) => void)[] = [
      (contract) => { contract.steps.splice(0, 0, { blocks: ["intro"], grading: [] }); },
      (contract) => { contract.steps.splice(0, 1); },
      (contract) => { contract.steps[1].blocks[1] = "renamed-question"; },
      (contract) => { contract.steps[1].grading = []; },
      (contract) => {
        const question = contract.steps[1].grading[0];
        if (question.type !== "multipleChoiceQuestion") throw new Error("Expected a multiple choice question");
        question.correctOptionId = "0";
      },
      (contract) => { contract.steps.splice(-1, 0, structuredClone(contract.steps[1])); },
      (contract) => { contract.moduleId = "different-module"; },
      (contract) => { contract.slug = "different-url"; },
    ];
    for (const edit of edits) {
      const current = structuredClone(original);
      edit(current);
      expect(() => expectCompatible(original, current)).toThrow();
    }
  });
  it("keeps published checkpoints unchanged; extensions belong in new mastery items (#122)", () => {
    const original = currentContract("returns-checkpoint");
    const current = structuredClone(original);
    current.steps.splice(-1, 0, { blocks: ["extra-checkpoint-content"], grading: [] });
    expect(() => expectCompatible(original, current)).toThrow();
  });
});
