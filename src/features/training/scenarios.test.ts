import { describe, expect, it } from "vitest";
import { backtestHistoryPlans } from "@/features/backtesting/catalog";
import { BacktestDataError } from "@/features/backtesting/spec";
import { createMarketDataService } from "@/features/market-data/composition";
import type { MarketDataService } from "@/features/market-data/service";
import { availableScenarios, loadScenarioSeries } from "./scenarios";

const deterministic = () => createMarketDataService({ provider: "deterministic", fxProvider: "deterministic" });

describe("loadScenarioSeries", () => {
  it("offers only scenarios whose whole window the provider's plan loads", () => {
    expect(availableScenarios(backtestHistoryPlans.deterministic).map(({ id }) => id)).toEqual(["model-crisis-v1", "history-2020-v1", "history-2022-v1"]);
    expect(availableScenarios(backtestHistoryPlans.fmp).map(({ id }) => id)).toEqual(["model-crisis-v1", "history-2008-v1", "history-2020-v1", "history-2022-v1"]);
  });

  it("rebases month-end closes to 100 and labels sample price-only data with its provenance", async () => {
    const series = await loadScenarioSeries(deterministic(), backtestHistoryPlans.deterministic, "history-2020-v1");
    expect(series.points).toHaveLength(25);
    expect(series.points[0]).toEqual({ date: "2019-12-31", price: "100" });
    expect(series.points.at(-1)!.date).toBe("2021-12-31");
    expect(series.source).toMatchObject({ kind: "history", sample: true, symbol: "SPX", currency: "USD" });
  });

  it("refuses an unknown scenario and a missing month instead of filling it", async () => {
    await expect(loadScenarioSeries(deterministic(), backtestHistoryPlans.deterministic, "history-2008-v1")).rejects.toThrow(BacktestDataError);
    const service = deterministic();
    const gappy = {
      getHistoricalPrices: async (request: Parameters<MarketDataService["getHistoricalPrices"]>[0]) => {
        const series = await service.getHistoricalPrices(request);
        return { ...series, points: series.points.filter(({ date }) => !date.startsWith("2020-04")) };
      },
    } as unknown as MarketDataService;
    await expect(loadScenarioSeries(gappy, backtestHistoryPlans.deterministic, "history-2020-v1")).rejects.toThrow(/chybí měsíční uzávěrka za 2020-04/);
  });
});
