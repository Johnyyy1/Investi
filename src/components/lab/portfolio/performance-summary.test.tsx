import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PortfolioPerformance } from "@/features/portfolio/performance";
import { PerformanceSummary } from "./performance-summary";

const performance: PortfolioPerformance = { startedAt: "2023-01-01T00:00:00Z", endedAt: "2024-12-31T00:00:00Z", twrMethod: "prior-daily-close-estimate", twr: { status: "available", basisPoints: "800", annualizedBasisPoints: "392" }, mwr: { status: "available", basisPoints: "-1174", annualizedBasisPoints: "-605" } };
const render = (value = performance) => renderToStaticMarkup(createElement(PerformanceSummary, { performance: value })).replaceAll("\u00a0", " ");
describe("performance explanation", () => {
  it("compares annual rates with annual rates, labels estimates, and discloses the cumulative return", () => {
    const html = render();
    expect(html).toContain("+3,92 %");
    expect(html).toContain("−6,05 %");
    expect(html).toContain("ročně · odhad");
    expect(html).toContain("Za celé období +8,00 %");
    expect(html).toContain("sám ale nedokazuje chybu v chování");
    expect(html).not.toContain('href="/learn/returns/time-vs-money-weighted"');
  });
  it("exposes missing history independently of MWR and avoids annualizing short periods", () => {
    const html = render({ ...performance, twr: { status: "unavailable", reason: "missing-valuation" }, mwr: { status: "available", basisPoints: "100", annualizedBasisPoints: null } });
    expect(html).toContain("Nedostupné");
    expect(html).toContain("historické ceny či kurzy");
    expect(html).toContain("+1,00 %");
    expect(html).toContain("za období");
    expect(html).not.toContain("ročně</small>");
  });
});
