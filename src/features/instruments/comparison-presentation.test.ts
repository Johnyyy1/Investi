import { describe, expect, it } from "vitest";
import { comparisonChartLabel, comparisonDataLabel, comparisonMetricRows, correlationReading, correlationView, formatCoefficient, formatIndexLevel } from "./comparison-presentation";
import type { ReturnCorrelation } from "./correlation";
import type { PriceMetrics } from "./price-metrics";

const metrics: PriceMetrics = {
  startDate: "2025-01-16",
  endDate: "2026-01-16",
  observationCount: 250,
  spanDays: 365,
  periodReturn: 0.25,
  annualisedReturn: 0.1,
  maxDrawdown: { depth: -0.2, peakDate: "2025-02-03", peakClose: 100, troughDate: "2025-04-08", troughClose: 80, recoveryDate: "2025-08-01" },
  annualisedVolatility: 0.3333,
};

const ok: ReturnCorrelation = { status: "ok", coefficient: 0.8234, observationCount: 249, startDate: "2025-01-16", endDate: "2026-01-16", frequency: "daily" };

describe("comparison presentation model", () => {
  it("lists the detail's metrics in order with both instruments side by side", () => {
    const rows = comparisonMetricRows(metrics, { ...metrics, periodReturn: -0.1, annualisedReturn: null, annualisedVolatility: 0.1 });
    expect(rows.map((row) => row.label)).toEqual(["Jednoduchý výnos", "Roční výnos", "Největší propad", "Volatilita"]);
    expect(rows[0].values.map((value) => value?.value)).toEqual(["+25,0 %", "−10,0 %"]);
    expect(rows[0].values.map((value) => value?.tone)).toEqual(["positive", "negative"]);
    expect(rows[1].values[1]).toMatchObject({ value: null, meaning: "Pro období kratší než jeden rok se výnos nepřepočítává na rok." });
    expect(rows[3].values.map((value) => value?.value)).toEqual(["33,3 %", "10 %"]);
    expect(rows[3].unit).toBe("ročně");
    expect(rows.every((row) => row.help.length > 0)).toBe(true);
  });

  it("marks a side without price history as unavailable rather than zero", () => {
    const rows = comparisonMetricRows(null, metrics);
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.values[0] === null && row.values[1] !== null)).toBe(true);
    const none = comparisonMetricRows(null, null);
    expect(none.map((row) => row.label)).toEqual(["Jednoduchý výnos", "Roční výnos", "Největší propad", "Volatilita"]);
    expect(none.every((row) => row.values.every((value) => value === null))).toBe(true);
  });

  it("rounds the coefficient only for display, with a real minus sign and no negative zero", () => {
    expect(formatCoefficient(0.8234)).toBe("0,82");
    expect(formatCoefficient(-0.456)).toBe("−0,46");
    expect(formatCoefficient(-0.004)).toBe("0,00");
    expect(formatCoefficient(1)).toBe("1,00");
    expect(formatCoefficient(-1)).toBe("−1,00");
  });

  it.each([
    [0.95, "Silná kladná korelace"],
    [0.7, "Silná kladná korelace"],
    [0.69, "Střední kladná korelace"],
    [0.3, "Střední kladná korelace"],
    [0.29, "Slabá nebo žádná korelace"],
    [0, "Slabá nebo žádná korelace"],
    [-0.29, "Slabá nebo žádná korelace"],
    [-0.3, "Střední záporná korelace"],
    [-0.7, "Silná záporná korelace"],
  ])("reads r = %s as %s", (coefficient, label) => {
    expect(correlationReading(coefficient).label).toBe(label);
  });

  it("shows the coefficient with its basis, or an explicit unavailable state", () => {
    expect(correlationView(ok, null)).toEqual({ status: "ok", value: "0,82", label: "Silná kladná korelace", meaning: expect.any(String), basis: "249 společných denních výnosů · 16. 1. 2025 – 16. 1. 2026" });
    const short: ReturnCorrelation = { status: "insufficient-data", coefficient: null, observationCount: 9, startDate: "2026-01-05", endDate: "2026-01-16", frequency: "daily" };
    expect(correlationView(short, "Pro korelaci je potřeba alespoň 20 společných denních výnosů.")).toEqual({ status: "unavailable", message: "Pro korelaci je potřeba alespoň 20 společných denních výnosů.", basis: "9 společných denních výnosů · 5. 1. 2026 – 16. 1. 2026" });
    expect(correlationView(null, null)).toEqual({ status: "unavailable", message: "Korelaci pro toto období nelze spočítat.", basis: null });
  });

  it("summarises the rebased chart in text, naming the line styles", () => {
    const label = comparisonChartLabel({ symbol: "AAPL", name: "Apple Inc." }, { symbol: "MSFT", name: "Microsoft Corporation" }, [
      { date: "2026-01-05", first: 100, second: 100 },
      { date: "2026-01-16", first: 114, second: 106 },
    ]);
    expect(label).toBe("Srovnávací graf: obě řady přepočtené na 100 k 5. 1. 2026, 2 společné zavírací ceny do 16. 1. 2026. Řada A, Apple Inc. (AAPL, plná čára), skončila na 114,0. Řada B, Microsoft Corporation (MSFT, přerušovaná čára), skončila na 106,0. Jen cena, bez dividend.");
    expect(formatIndexLevel(99.95)).toBe("100,0");
  });

  it("labels the comparison as sample data whenever either series is sample data", () => {
    expect(comparisonDataLabel([{ dataKind: "synthetic", isDeterministic: true }, { dataKind: "historical", isDeterministic: false }])).toBe("Ukázková data");
    expect(comparisonDataLabel([{ dataKind: "historical", isDeterministic: false }, null])).toBe("Historická data");
  });
});
