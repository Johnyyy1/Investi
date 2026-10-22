import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { emptyExperimentDraft, ExperimentFields, parseExperimentDraft } from "./backtest-experiments";

it("parses Czech decimal inputs, preserves zero defaults and refuses invalid amounts", () => {
  expect(parseExperimentDraft(emptyExperimentDraft)).toEqual({});
  expect(parseExperimentDraft({ ...emptyExperimentDraft, monthly: "0,25", fundCost: "1,33", withdrawal: "4", withdrawalKind: "rate", holdout: "2021" })).toEqual({ contributions: { monthlyAmount: 0.25 }, annualFundCostBps: 133, withdrawals: { annualRate: 0.04 }, outOfSampleStartMonth: "2021-01" });
  for (const draft of [{ monthly: "-1" }, { monthly: "" }, { fundCost: "0,125" }, { withdrawal: "-5" }, { fundCost: "21" }]) expect(() => parseExperimentDraft({ ...emptyExperimentDraft, ...draft })).toThrow();
});
it("labels the fund cost as additional and warns that a split does not guarantee independence", () => {
  const html = renderToStaticMarkup(<ExperimentFields draft={emptyExperimentDraft} onChange={() => {}} currency="USD" years={[2020, 2021, 2022]} />);
  expect(html).toContain("Historické ceny mohou náklady fondu již zahrnovat");
  expect(html).toContain("Rozdělení samo nezaručuje nezávislý test");
  expect(html).toContain("Měsíční příspěvek v backtestu");
});
