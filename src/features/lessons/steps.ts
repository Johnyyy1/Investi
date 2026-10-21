import type { AuthoredLesson, StepDefinition } from "./types";
import { foundationsSteps } from "./foundations/content";
import { returnsSteps } from "./returns/flow";
import { volatilitySteps } from "./volatility/flow";
import { correlationSteps } from "./correlation/flow";
import { diversificationSteps } from "./diversification/flow";
import { availableLessons } from "../learning/catalog";

/** Every module exports its own steps by lesson ID. A new module only adds its map here. */
export const moduleSteps: readonly Readonly<Record<string, readonly StepDefinition[]>>[] = [foundationsSteps, returnsSteps, volatilitySteps, correlationSteps, diversificationSteps];
const stepDefinitions: Readonly<Record<string, readonly StepDefinition[]>> = Object.assign({}, ...moduleSteps);

export function getStepDefinitions(lessonId: string): readonly StepDefinition[] {
  if (!Object.hasOwn(stepDefinitions, lessonId)) throw new Error("This lesson is not available.");
  return stepDefinitions[lessonId];
}
/** Presentation only: the authored lessons remain the source of every concept and exercise. */
export function getGuidedSteps(lesson: AuthoredLesson) {
  return getStepDefinitions(lesson.id).map((step) => ({ title: step.title, kind: step.kind, blocks: step.blocks.map((id) => {
    const block = lesson.blocks.find((item) => item.id === id);
    if (!block) throw new Error(`Missing authored block: ${id}`);
    return block;
  }) }));
}
export function isFocusedLesson(pathname: string) {
  return availableLessons.some((lesson) => pathname === `/learn/${lesson.moduleSlug}/${lesson.slug}`);
}
