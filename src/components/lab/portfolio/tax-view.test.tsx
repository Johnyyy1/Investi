import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TaxView } from "@/features/portfolio/tax-lots";
import { TaxPanel } from "./tax-view";

const tax: TaxView = { year: 2026, proceedsMinor: "3000000", saleCount: 2, limitMinor: "10000000", limitVerifiedAt: "2026-10-22", lots: [{ tradeId: "t1", symbol: "VWCE", acquiredAt: "2026-01-05T09:00:00.000Z", quantity: "1.25", costMinor: "295000" }] };
const text = (view: TaxView) => renderToStaticMarkup(createElement(TaxPanel, { tax: view })).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("tax panel", () => {
  it("labels the estimate, its date, the pairing assumption and links the export", () => {
    const html = renderToStaticMarkup(createElement(TaxPanel, { tax }));
    expect(text(tax)).toMatch(/Vzdělávací odhad, ne daňové poradenství; stav k 22\. 10\. 2026/);
    expect(text(tax)).toContain("FIFO");
    expect(text(tax)).toMatch(/30\s000\sKč z limitu 100\s000\sKč/);
    expect(text(tax)).toContain("koupeno 5. 1. 2026");
    expect(html).toContain('href="/api/portfolio/export"');
  });

  it("never shows a limit without a verified version for the year", () => {
    const output = text({ ...tax, year: 2027, limitMinor: null, limitVerifiedAt: null });
    expect(output).toContain("Limit pro rok 2027 zatím nemáme ověřený");
    expect(output).not.toContain("z limitu");
    expect(output).not.toContain("stav k");
  });
});
