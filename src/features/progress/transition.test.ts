import { describe, expect, it } from "vitest";
import { lessonSteps, validateCompletion, validateMove } from "./transition";
import { availableLessons } from "@/features/learning/catalog";
describe("server-side completion eligibility", () => {
  it.each(availableLessons.map((lesson) => lesson.id))("requires the final saved step of %s", (id) => {
    expect(() => validateCompletion(id)).toThrow();
    expect(() => validateCompletion(id, { status: "in_progress", lastPosition: 0 })).toThrow();
    expect(() => validateCompletion(id, { status: "in_progress", lastPosition: lessonSteps(id).length - 1 })).not.toThrow();
    expect(() => validateCompletion(id, { status: "completed", lastPosition: 0 })).not.toThrow();
  });
  it("rejects jumps, blank questions and planned lessons", () => {
    expect(() => validateMove("foundations-stocks", 0, 8)).toThrow();
    expect(() => validateMove("foundations-stocks", 0, 1)).toThrow();
    expect(() => validateMove("foundations-why-invest", 0, 3)).toThrow();
    expect(() => validateMove("foundations-checkpoint", 0, 1)).toThrow();
  });
  it("requires a correct answer and permits navigation back", () => {
    const block = lessonSteps("foundations-stocks")[0].blocks.find((b) => b.type === "multipleChoiceQuestion")!;
    if (block.type !== "multipleChoiceQuestion") throw new Error("Test expects a question");
    expect(() => validateMove("foundations-stocks", 0, 1, { answer: block.options[0].id })).toThrow();
    expect(() => validateMove("foundations-stocks", 0, 1, { answer: block.correctOptionId })).not.toThrow();
    expect(() => validateMove("foundations-stocks", 5, 4)).not.toThrow();
    expect(() => validateMove("foundations-stocks", 5, 5)).not.toThrow();
  });
  it("lets the first mini-lesson finish only after its question is answered correctly", () => {
    expect(lessonSteps("foundations-why-invest")).toHaveLength(3);
    expect(() => validateMove("foundations-why-invest", 0, 1)).not.toThrow();
    const block = lessonSteps("foundations-why-invest")[1].blocks.find((b) => b.type === "multipleChoiceQuestion")!;
    if (block.type !== "multipleChoiceQuestion") throw new Error("Test expects a question");
    for (const option of block.options.filter((option) => option.id !== block.correctOptionId)) expect(() => validateMove("foundations-why-invest", 1, 2, { answer: option.id })).toThrow();
    expect(() => validateMove("foundations-why-invest", 1, 2, { answer: block.correctOptionId })).not.toThrow();
    expect(() => validateCompletion("foundations-why-invest", { status: "in_progress", lastPosition: 1 })).toThrow();
  });
});
