import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compoundValue, recoveryReturn, simpleReturn } from "@/features/finance/returns";
import { availableLessons } from "@/features/learning/catalog";
import { authoredLessons } from "./registry";
import type { LessonBlock } from "./types";

const published = authoredLessons.filter((lesson) => availableLessons.some((definition) => definition.id === lesson.id));
const hasNumericAnswer = (block: LessonBlock) => block.type === "numericQuestion" || block.type === "multiNumericQuestion"
  || (block.type === "fadedExample" && block.blank.input === "number") || (block.type === "documentSearchQuestion" && block.target.type === "numeric");

/** The numbers a prompt or field label gives the learner, read the Czech way ("2 000", "99,80", "−20 %"). */
const inputs = (text: string) => [...text.matchAll(/[−+-]?\d+(?:\s\d{3})*(?:,\d+)?/g)].map((match) => Number(match[0].replace(/\s/g, "").replace(",", ".").replace("−", "-")));
const percent = (start: number, end: number) => simpleReturn(start, end) * 100;

type Compute = (numbers: number[]) => number;
/** Answers that no module test recomputes yet, each derived from the numbers its prompt (or field label) shows. */
const recomputed: Record<string, Record<string, Compute | Record<string, Compute>>> = {
  "foundations-stocks": { "position-practice": ([count, price]) => count * price, "mastery-position": ([count, price]) => count * price },
  "foundations-markets": { "spread-practice": ([bid, ask]) => ask - bid },
  "foundations-risk-reward": {
    "positive-return": ([start, end]) => percent(start, end),
    "mastery-negative": ([start, end]) => percent(start, end),
    "mastery-compound": ([start, up, down]) => compoundValue(start, [up / 100, -down / 100]),
  },
  "foundations-portfolio": { "mastery-stock-weight": ([portfolio, position]) => position / portfolio * 100 },
  "returns-what-is-a-return": { "numeric": ([start, end]) => percent(start, end) },
  "returns-simple-returns": {
    "first-calculation": ([start, end]) => percent(start, end),
    "negative-return": ([start, end]) => percent(start, end),
    "decimal-practice": { percent: ([decimal]) => decimal * 100, decimal: ([rate]) => rate / 100 },
    "two-periods": { first: ([start, end]) => percent(start, end), second: ([start, end]) => percent(start, end) },
  },
  "returns-compounding": {
    "ending-value-practice": ([start, ...changes]) => compoundValue(start, changes.map((change) => change / 100)),
    "loss-practice": ([loss]) => recoveryReturn(loss / 100) * 100,
  },
};

describe("published numeric answers", () => {
  it("recompute from the numbers the learner sees", () => {
    for (const [lessonId, checks] of Object.entries(recomputed)) {
      const lesson = published.find((item) => item.id === lessonId)!;
      for (const [blockId, compute] of Object.entries(checks)) {
        const block = lesson.blocks.find((item) => item.id === blockId);
        if (block?.type === "numericQuestion" && typeof compute === "function") expect(compute(inputs(block.prompt)), blockId).toBeCloseTo(block.answer, 6);
        else if (block?.type === "multiNumericQuestion" && typeof compute === "object") {
          expect(Object.keys(compute).sort(), blockId).toEqual(block.answers.map((field) => field.id).sort());
          for (const field of block.answers) expect(compute[field.id](inputs(field.label)), `${blockId}.${field.id}`).toBeCloseTo(field.answer, 6);
        } else throw new Error(`${lessonId}/${blockId} does not match a numeric question`);
      }
    }
  });

  it("are each recomputed by a test", () => {
    // shortcut: matches the block ID as a quoted literal in any test, not the recomputation itself; IDs repeat across lessons, so move to a per-lesson table if a match turns out to be accidental.
    const tests = readdirSync("src", { recursive: true, encoding: "utf8" }).filter((file) => /\.test\.tsx?$/.test(file)).map((file) => readFileSync(`src/${file}`, "utf8")).join("\n");
    const missing = published.flatMap((lesson) => lesson.blocks.filter(hasNumericAnswer).filter((block) => !tests.includes(`"${block.id}"`)).map((block) => `${lesson.id}/${block.id}`));
    expect(missing).toEqual([]);
  });
});
