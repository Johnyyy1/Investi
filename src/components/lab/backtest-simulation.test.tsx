import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BacktestSimulation } from "./backtest-simulation";
import { SimulationFanChart } from "./simulation-fan-chart";
import { buildSimulation, defaultSimulationConfig } from "./simulation-model";

const path = (months: number) => Array.from({ length: months + 1 }, (_, index) => 100 * (1 + 0.01 * index) * (1 + 0.02 * Math.cos(index)));
const props = { basis: "Mix 60 / 40 · Leden 2015 – prosinec 2025", sourceTag: "Ukázková data", currency: "CZK" as const, amount: 100_000 };

describe("simulation step after a backtest", () => {
  it("frames the simulation as uncertainty from past data, not a forecast", () => {
    const html = renderToStaticMarkup(createElement(BacktestSimulation, { ...props, values: path(132) }));
    expect(html).toContain("Co by mohlo nastat dál?");
    expect(html).toContain("Není to předpověď ani doporučení.");
    expect(html).toContain("minulost se nemusí opakovat");
    expect(html).toContain("132 měsíců, Mix 60 / 40");
    expect(html).toContain('value="100000"');
    expect(html).toContain("Spustit simulaci");
    expect(html).not.toContain("simulation-short-history");
  });
  it("warns that a short history narrows the range", () => {
    const html = renderToStaticMarkup(createElement(BacktestSimulation, { ...props, values: path(36) }));
    expect(html).toContain("Historie má jen 36 měsíců.");
    expect(html).toContain("Spustit simulaci");
  });
  it("offers no simulation when the history is too short to draw blocks from", () => {
    const html = renderToStaticMarkup(createElement(BacktestSimulation, { ...props, values: path(12) }));
    expect(html).toContain("alespoň 24 měsíců historie, tento backtest má 12");
    expect(html).not.toContain("Spustit simulaci");
  });
});

describe("fan chart", () => {
  it("labels the simulation, describes it in text and lists every year in a table", () => {
    const result = buildSimulation(path(60), { ...defaultSimulationConfig("1000"), years: 3, contribution: "50" });
    const html = renderToStaticMarkup(createElement(SimulationFanChart, { result, currency: "USD", sourceTag: "Historická data" }));
    expect(html).toContain("Simulace · Historická data");
    expect(html).toMatch(/role="img" aria-label="Simulace 1\s000 cest\. Za 3 roky je prostřední cesta \(medián\)/);
    expect(html).toContain("90 % cest · P5–P95");
    expect(html).toContain("Polovina cest · P25–P75");
    expect(html).toContain('scope="row">Start</th>');
    expect(html).toContain('scope="row">Rok 3</th>');
    expect(html).toMatch(/Vloženo celkem 2\s800\s\$/);
    expect(html).toMatch(/z 1\s000 cest/);
  });
});
