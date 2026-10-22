import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { exampleIps } from "@/features/ips/test-fixtures";
import { portfolioProcess, type ProcessInput } from "@/features/portfolio/process";
import { ProcessFeedback } from "./process-feedback";

const base: ProcessInput = {
  openedAt: "2026-10-01T12:00:00.000Z", asOf: "2026-10-22T12:00:00.000Z",
  cashMinor: 20000n, totalMinor: 100000n, holdings: [{ instrumentId: "IE-XETR:VWCE", symbol: "VWCE", marketValueMinor: 80000n }],
  trades: [], ips: { version: 3, payload: exampleIps },
};
const render = (input: ProcessInput) => renderToStaticMarkup(createElement(ProcessFeedback, { feedback: portfolioProcess(input) }));
describe("process summary", () => {
  it("makes every criterion, value, status and calculation available as text", () => {
    const html = render(base);
    expect(html).toContain("Portfolio je v pásmu tvého plánu.");
    expect(html.match(/data-testid="process-/g)).toHaveLength(6);
    expect(html.match(/<summary/g)).toHaveLength(6);
    expect(html).toContain("Limit pozice v IPS neurčen");
    expect(html).toContain("IPS verze 3");
    expect(html).toContain("Zaznamenané náklady");
    expect(html).toContain('href="/lab/plan"');
    expect(html).not.toMatch(/82\/100|Skóre:|Nakoupit teď/);
  });
  it("explains missing IPS, unknown prices, and drift without relying on color or demanding a trade", () => {
    expect(render({ ...base, ips: null })).toContain("Bez něj nemáme tvůj cíl");
    const missing = render({ ...base, totalMinor: null, holdings: [{ ...base.holdings[0], marketValueMinor: null }] });
    expect(missing).toContain("Chybí úplné ocenění");
    expect(missing).toContain("Zaznamenané náklady");
    const drift = render({ ...base, cashMinor: 30000n, holdings: [{ ...base.holdings[0], marketValueMinor: 70000n }] });
    expect(drift).toContain("Mimo pásmo plánu");
    expect(drift).toContain("I ponechat portfolio podle plánu je rozhodnutí");
  });
});
