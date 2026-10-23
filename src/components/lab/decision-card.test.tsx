import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DecisionCard } from "./decision-card";

describe("DecisionCard", () => {
  it("names the card, lists safeguards, links the lesson and offers to turn the kind off", () => {
    const html = renderToStaticMarkup(createElement(DecisionCard, { kind: "turnover", safeguards: [{ trigger: "Pátý obchod", action: "Počkám týden." }], onDisable: () => {} }));
    expect(html).toContain('role="note" aria-labelledby="decision-card-turnover"');
    expect(html).toContain('id="decision-card-turnover" class="break-words font-bold">Pět a více obchodů za posledních 7 dní');
    expect(html).toContain("Pátý obchod: Počkám týden.");
    expect(html).toContain('href="/learn/investing-foundations/how-markets-work"');
    expect(html).toContain("Tento typ karty už nezobrazovat");
    expect(renderToStaticMarkup(createElement(DecisionCard, { kind: "turnover", onDisable: () => {} }))).not.toContain("Tvoje pojistky");
  });
});
