import { describe, expect, it } from "vitest";
import { FinancialInputError } from "@/features/finance/returns";
import { buildSimulation, defaultSimulationConfig, fanRows, formatSimulationMonth, formatYears, simulationSummary, yearlyRows, type SimulationHorizon } from "./simulation-model";

/** A backtest path of 37 month-end values: 36 monthly returns. */
const values = Array.from({ length: 37 }, (_, index) => 10_000 * (1 + 0.006 * index) * (1 + 0.03 * Math.sin(index)));
const config = (overrides = {}) => ({ ...defaultSimulationConfig("10000"), ...overrides });

describe("simulation from a backtest path", () => {
  it("draws 1 000 paths over the chosen years from the path's monthly returns", () => {
    const result = buildSimulation(values, config({ years: 3, contribution: "200" }));
    expect(result).toMatchObject({ paths: 1_000, historyMonths: 36, blockMonths: 6, years: 3, amount: 10_000, contribution: 200 });
    expect(result.months).toHaveLength(37);
    expect(result.months.at(-1)!.contributed).toBe(10_000 + 200 * 36);
  });
  it("is reproducible for the same settings and seed", () => {
    expect(buildSimulation(values, config())).toEqual(buildSimulation(values, config()));
    expect(buildSimulation(values, config({ seed: 1 })).finalValues).not.toEqual(buildSimulation(values, config()).finalValues);
  });
  it("treats an empty contribution as none and refuses invalid inputs", () => {
    expect(buildSimulation(values, config({ contribution: " " })).contribution).toBe(0);
    for (const overrides of [{ amount: "" }, { amount: "0" }, { amount: "abc" }, { contribution: "-5" }, { years: 7 as SimulationHorizon }]) {
      expect(() => buildSimulation(values, config(overrides))).toThrow(FinancialInputError);
    }
    expect(() => buildSimulation(values.slice(0, 13), config())).toThrow("alespoň 24 měsíců");
  });
});

describe("simulation presentation", () => {
  const result = buildSimulation(values, config({ years: 1 }));
  it("pairs the band edges for the chart", () => {
    const [start, ...rest] = fanRows(result);
    expect(start.outer).toEqual([start.p5, start.p95]);
    expect(rest.at(-1)!.inner).toEqual([rest.at(-1)!.p25, rest.at(-1)!.p75]);
  });
  it("lists the start and every year end in the table", () => {
    expect(yearlyRows(buildSimulation(values, config({ years: 3 }))).map((row) => row.month)).toEqual([0, 12, 24, 36]);
  });
  it("names months and years in Czech", () => {
    expect([0, 5, 12, 29].map(formatSimulationMonth)).toEqual(["Start", "Měsíc 5", "Rok 1", "Rok 2, měsíc 5"]);
    expect([1, 3, 5, 20].map(formatYears)).toEqual(["1 rok", "3 roky", "5 let", "20 let"]);
  });
  it("summarizes the median and both ranges as the chart's text alternative", () => {
    const summary = simulationSummary(result, "USD");
    expect(summary).toMatch(/^Simulace 1\s000 cest\. Za 1 rok je prostřední cesta \(medián\) /);
    expect(summary).toContain("Polovina cest skončila mezi");
    expect(summary).toContain("90 % cest mezi");
    expect(summary).toContain("Vloženo celkem");
    expect(summary).not.toMatch(/pravděpodobnost/i);
  });
});
