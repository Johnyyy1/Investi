import { describe, expect, it } from "vitest";
import katex from "katex";
import { portfolioWeightedReturn } from "@/features/finance/foundations";
import { getModuleBySlug, getModuleLessons } from "@/features/learning/catalog";
import { validateCompletion, validateMove } from "@/features/progress/transition";
import { lessonReward, LESSON_PRACTICE_CAPITAL_MINOR, MODULE_REWARD_POLICY_VERSION } from "@/features/rewards/practice-capital";
import { evaluateQuestion, isQuestion } from "../question-evaluation";
import { getAuthoredLesson } from "../registry";
import { getGuidedSteps } from "../steps";
import { block, correctAnswers, numericAnswer, wrongAnswers } from "../lesson-test-support";
import { concentrationLesson } from "./concentration";
import { correlationAndRiskLesson } from "./correlation-and-risk";
import { diversificationScenarioLesson } from "./diversification-scenario";
import { etfLookThroughLesson } from "./etf-look-through";
import { diversificationLessons, DIVERSIFICATION_MODULE_ID } from "./manifest";
import { basisPointsToPercent, concentrationSample, evaluateScenario, exposureSamples, largestExposure, lookThrough, lookThroughPresets, MAX_POSITION_PERCENT, positionWeights, scenarioRules, singlePositionImpact, twoAssetVolatility } from "./model";
import { sectorsAndCountriesLesson } from "./sectors-and-countries";

const lessons = [concentrationLesson, sectorsAndCountriesLesson, etfLookThroughLesson, correlationAndRiskLesson, diversificationScenarioLesson];
const percentOf = (rows: ReturnType<typeof lookThrough>, key: string) => rows.find((row) => row.key === key)?.percent;

describe("Diversification module", () => {
  it("publishes five lessons as one available module", () => {
    expect(diversificationLessons.map((lesson) => lesson.status)).toEqual(Array(5).fill("available"));
    expect(getModuleBySlug("diversification")).toMatchObject({ status: "available", lessonCount: 5, estimatedMinutes: 55 });
    expect(getModuleLessons("diversification").map((lesson) => lesson.moduleId)).toEqual(Array(5).fill(DIVERSIFICATION_MODULE_ID));
    for (const [index, lesson] of lessons.entries()) {
      expect(getAuthoredLesson("diversification", diversificationLessons[index].slug)).toBe(lesson);
      expect(lesson).toMatchObject({ id: diversificationLessons[index].id, position: index + 1, moduleSlug: "diversification" });
    }
  });

  it("chains the lessons in curriculum order", () => {
    for (const [index, lesson] of lessons.entries()) {
      expect(lesson.navigation?.previous?.href).toBe(index === 0 ? undefined : `/learn/diversification/${diversificationLessons[index - 1].slug}`);
      expect(lesson.navigation?.next?.href).toBe(index === lessons.length - 1 ? undefined : `/learn/diversification/${diversificationLessons[index + 1].slug}`);
    }
  });

  it("rewards each first completion with 2,000 Kč of Practice Capital under policy v3", () => {
    for (const lesson of diversificationLessons) expect(lessonReward(lesson.id)).toEqual({ practiceCapitalMinor: LESSON_PRACTICE_CAPITAL_MINOR, rewardPolicyVersion: MODULE_REWARD_POLICY_VERSION });
  });

  it.each(lessons)("$title opens with a question, has an interactive task and at least four questions", (lesson) => {
    expect(getGuidedSteps(lesson)[0].blocks.some(isQuestion)).toBe(true);
    expect(lesson.blocks.filter(isQuestion).length).toBeGreaterThanOrEqual(4);
    expect(lesson.blocks.some((item) => item.type === "interactiveFigure")).toBe(true);
  });

  it.each(lessons)("$title gates every question step and accepts the authored answer", (lesson) => {
    for (const [index, step] of getGuidedSteps(lesson).entries()) {
      const question = step.blocks.find(isQuestion);
      if (!question) continue;
      expect(evaluateQuestion(question, wrongAnswers(question))).toBe(false);
      expect(() => validateMove(lesson.id, index, index + 1, wrongAnswers(question))).toThrow();
      expect(evaluateQuestion(question, correctAnswers(question))).toBe(true);
      expect(() => validateMove(lesson.id, index, index + 1, correctAnswers(question))).not.toThrow();
    }
  });

  it.each(lessons)("$title shows every authored block once, never repeats a step title and completes only from the last step", (lesson) => {
    const steps = getGuidedSteps(lesson);
    expect(steps.flatMap((step) => step.blocks.map((item) => item.id)).sort()).toEqual(lesson.blocks.map((item) => item.id).sort());
    for (const step of steps) for (const item of step.blocks) if ("title" in item) expect(item.title).not.toBe(step.title);
    const last = steps.length - 1;
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: last - 1 })).toThrow();
    expect(() => validateCompletion(lesson.id, { status: "in_progress", lastPosition: last })).not.toThrow();
  });

  it.each(lessons)("$title uses valid KaTeX", (lesson) => {
    for (const item of lesson.blocks) if (item.type === "formula") expect(() => katex.renderToString(item.latex ?? item.expression, { throwOnError: true, strict: "error" })).not.toThrow();
  });

  it("keeps the scenario separate from the personal portfolio and scores it by rules", () => {
    const intro = block(diversificationScenarioLesson, "intro", "heading");
    expect(intro.body).toContain("nic se nenakupuje v tvém Portfolio Labu");
    expect(block(diversificationScenarioLesson, "scenario-check", "multipleChoiceQuestion").correctOptionId).toBe("rules");
    expect(JSON.stringify(diversificationScenarioLesson)).not.toMatch(/\d+ ?\/ ?100\b|skóre \d/);
  });
});

describe("Diversification answers follow Portfolio Lab's arithmetic", () => {
  it("Concentration: weights include cash and the impact is weight × move", () => {
    const weights = positionWeights([{ id: "a", value: 30_000 }, { id: "rest", value: 75_000 }, { id: "cash", value: 15_000 }]);
    expect(basisPointsToPercent(weights.rows[0].weightBasisPoints)).toBe(numericAnswer(concentrationLesson, "weight-practice"));
    expect(singlePositionImpact(40, -0.3) * 100).toBeCloseTo(numericAnswer(concentrationLesson, "impact-practice"), 12);
    expect(singlePositionImpact(40, -0.3)).toBeCloseTo(portfolioWeightedReturn([0.4, 0.6], [-0.3, 0]), 12);
    const sample = positionWeights(concentrationSample);
    expect(basisPointsToPercent(sample.largest!.weightBasisPoints)).toBe(40);
    expect(basisPointsToPercent(sample.largest!.weightBasisPoints) > MAX_POSITION_PERCENT).toBe(true);
  });

  it("Concentration: weights round like every other portfolio weight", () => {
    const weights = positionWeights([{ id: "a", value: 1 }, { id: "b", value: 1 }, { id: "c", value: 1 }]);
    expect(weights.rows.map((row) => row.weightBasisPoints)).toEqual([3333n, 3333n, 3333n]);
  });

  it("Sectors and countries: five tech stocks are 90 % one sector and one country, cash stays its own category", () => {
    const { tech, mix } = exposureSamples;
    expect(lookThrough(tech.allocation, "sector", tech.instruments).map((row) => [row.key, row.kind, row.percent])).toEqual([["Technologie", "classified", 90], ["cash", "cash", 10]]);
    expect(largestExposure(lookThrough(tech.allocation, "country", tech.instruments))).toMatchObject({ key: "USA", percent: 72 });
    expect(largestExposure(lookThrough(mix.allocation, "sector", mix.instruments))?.percent).toBe(18);
    const practice = positionWeights([{ id: "tech", value: 60_000 + 30_000 + 20_000 }, { id: "bank", value: 40_000 }, { id: "cash", value: 30_000 + 20_000 }]);
    expect(basisPointsToPercent(practice.rows[0].weightBasisPoints)).toBe(numericAnswer(sectorsAndCountriesLesson, "sector-practice"));
  });

  it("ETF look-through: Čip 25,6 %, Technologie 62,5 %, USA 78 % by the Lab's exposure function", () => {
    const { allocation } = lookThroughPresets.overlap;
    expect(percentOf(lookThrough(allocation, "company"), "Čip")).toBe(25.6);
    expect(percentOf(lookThrough(allocation, "sector"), "Technologie")).toBe(numericAnswer(etfLookThroughLesson, "sector-practice"));
    expect(percentOf(lookThrough(allocation, "country"), "USA")).toBe(78);
    // Contributions explain the total: 2 % + 3,6 % + 20 %.
    expect(lookThrough(allocation, "company").find((row) => row.key === "Čip")?.contributions.map((item) => [item.instrumentId, item.percent])).toEqual([["cip", 20], ["tech", 3.6], ["svet", 2]]);
    // A remainder bucket is never the largest company, sector or country.
    expect(largestExposure(lookThrough(lookThroughPresets.world.allocation, "company"))).toMatchObject({ key: "Čip", percent: 4 });
    expect(largestExposure(lookThrough({ svet: 100 }, "country"))?.key).toBe("USA");
    expect(() => lookThrough({ svet: 70, tech: 40 }, "sector")).toThrow(RangeError);
  });

  it("Correlation and risk: the prediction, the practice and the quoted values", () => {
    expect(twoAssetVolatility(0.5, 0.2, 0.2, 0) * 100).toBeCloseTo(14.142, 3);
    expect(numericAnswer(correlationAndRiskLesson, "practice")).toBeCloseTo(twoAssetVolatility(0.5, 0.2, 0.1, 0.5) * 100, 2);
    expect(twoAssetVolatility(0.5, 0.2, 0.1, 1)).toBeCloseTo(0.15, 12);
    expect(twoAssetVolatility(0.5, 0.2, 0.1, 0) * 100).toBeCloseTo(11.18, 2);
    expect(twoAssetVolatility(0.5, 0.2, 0.2, -1)).toBeCloseTo(0, 12);
    expect(twoAssetVolatility(0.5, 0.18, 0.18, 0.1) * 100).toBeCloseTo(13.35, 2);
    expect(twoAssetVolatility(0.5, 0.18, 0.18, 0.9) * 100).toBeCloseTo(17.54, 2);
    expect(() => twoAssetVolatility(0.5, 0.2, 0.1, 1.2)).toThrow(RangeError);
  });

  it("Scenario: four explicit rules, both outcomes, and an all-cash portfolio is not diversified", () => {
    expect(scenarioRules.map((rule) => [rule.id, rule.maxPercent])).toEqual([["company", 10], ["sector", 40], ["country", 70], ["cash", 20]]);
    const world = evaluateScenario({ svet: 100 });
    expect(world.passed).toBe(true);
    expect(world.outcomes.map((outcome) => [outcome.id, Number((outcome.portfolioReturn * 100).toFixed(4))])).toEqual([["crash", -8.85], ["boom", 11]]);
    const tech = evaluateScenario({ tech: 100 });
    expect(tech.rules.filter((rule) => !rule.pass).map((rule) => rule.id)).toEqual(["company", "sector", "country"]);
    expect(tech.outcomes.map((outcome) => outcome.portfolioReturn)).toEqual([-0.3, 0.35]);
    // The best boom outcome does not pass: outcome and diversification are separate.
    expect(tech.outcomes[1].portfolioReturn).toBeGreaterThan(world.outcomes[1].portfolioReturn);
    expect(evaluateScenario({}).rules.find((rule) => rule.id === "cash")).toMatchObject({ percent: 100, pass: false });
    expect(evaluateScenario({ svet: 60, cip: 40 }).rules[0]).toMatchObject({ largest: "Čip", percent: numericAnswer(diversificationScenarioLesson, "look-through-check"), pass: false });
  });
});
