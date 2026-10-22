import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getFact } from "@/features/facts/registry";
import { formatFactValue } from "@/features/facts/resolve";
import { correctAnswers, wrongAnswers } from "@/features/lessons/answer-keys";
import { timeTestSpecimens as spec } from "@/features/lessons/specimens/time-test";
import type { LessonBlock } from "@/features/lessons/types";
import { GuidedBlock } from "../guided-block";
import { GuidedQuestion } from "../guided-question";
import { FactStatusChip } from "./fact-notice";
import { labMissionTargets } from "./lab-mission";

const question = (block: Parameters<typeof GuidedQuestion>[0]["block"], answers: Record<string, string> = {}, verdict?: boolean) =>
  renderToStaticMarkup(<GuidedQuestion block={block} answers={answers} verdict={verdict} mastery={false} onAnswer={() => {}} />);

describe("graded step kinds in the lesson player", () => {
  it("F: completes the last row and names the misconception after a wrong answer", () => {
    expect(question(spec.fadedExample)).toContain("Řešený příklad · dokonči");
    const wrong = question(spec.fadedExample, wrongAnswers(spec.fadedExample), false);
    expect(wrong).toContain("Častá záměna: počítat roky, ne dny od nákupu");
    expect(wrong).toContain("Rozhoduje den nákupu");
    expect(question(spec.fadedExample, correctAnswers(spec.fadedExample), true)).toContain(spec.fadedExample.correctExplanation);
  });

  it("G: shows only the chosen option's explanation", () => {
    const html = question(spec.choice, { answer: "all" }, false);
    expect(html).toContain("Častá záměna: test od prvního nákupu");
    expect(html).not.toContain(spec.choice.options[2].explanation);
  });

  it("H: marks every row with an icon and a word, never colour alone", () => {
    const html = question(spec.documentTap, { selected: "b1,b2,b4" }, false);
    for (const label of ["Správně · osvobození od 15. 1. 2024", "Chybí · test splněný od 3. 3. 2025", "Navíc · tři roky uplynou až 21. 6. 2025", "Správně neoznačeno · test až od 10. 5. 2026", "Prodej, ne nákup"]) expect(html).toContain(label);
    expect(html).toContain("chybí: 1 · navíc: 1");
    expect(html).toContain("Označeno: 3 · vyhodnoceno");
    expect(html.match(/type="checkbox"/g)).toHaveLength(10); // 5 selectable rows × (mobile list + desktop table)
  });

  it("I: asks for the fix only after a row is chosen and shows corrections once solved", () => {
    expect(question(spec.findError)).toContain("Nejdřív vyber řádek");
    expect(question(spec.findError, { row: "r2" })).toContain("Co je v řádku 2 špatně?");
    const solved = question(spec.findError, correctAnswers(spec.findError), true);
    expect(solved).toContain("Oprava: 9. 5. 2023 + 3 roky");
    expect(solved).toContain("Oprava: 2 900 Kč");
    expect(question(spec.findError, wrongAnswers(spec.findError), false)).not.toContain("Oprava:");
  });
});

describe("content step kinds", () => {
  const render = (block: LessonBlock) => renderToStaticMarkup(<GuidedBlock block={block} />);

  it("J: starts without a consequence; a choice reveals it", () => {
    const html = render(spec.personaDecision);
    expect(html).toContain("Petra, 34 let");
    expect(html).toContain("Osvobození od 15. 11. 2026 · za 26 dní");
    expect(html).not.toContain("Daň asi 855 Kč");
  });

  it("K: opens only an existing Lab area in a new tab and offers the sample-data path", () => {
    const html = render(spec.labMission);
    expect(html).toContain('href="/lab/portfolio"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Přeskočit, použiju ukázková data");
    expect(Object.keys(labMissionTargets).sort()).toEqual(["/lab/backtesting", "/lab/compare", "/lab/portfolio"]);
  });

  it("L: shows registry values and a calm pending state with the educational notice", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-21T12:00:00Z") });
    try {
      const html = render(spec.factNotice);
      expect(html).toContain(formatFactValue(getFact("dan.limit_100k").value));
      expect(html).toContain("Vzdělávací obsah, ne daňové poradenství");
      expect(html).toContain("Údaj čeká na ověření");
      expect(html).toContain("Naposledy kontrolováno 21. 10. 2026");
      expect(renderToStaticMarkup(<FactStatusChip factKeys={spec.factNotice.factKeys} />)).toContain("Údaj čeká na ověření");
    } finally {
      vi.useRealTimers();
    }
  });

  it("M: keeps the rubric as hints and hides the sample answer until sending", () => {
    const html = render(spec.writtenReflection);
    expect(html).toContain("Na co myslet");
    expect(html).not.toContain(spec.writtenReflection.sampleAnswer);
    expect(html).not.toContain('type="checkbox"');
  });
});
