import type { BacktestHistoryPlan } from "@/features/backtesting/catalog";
import { alignMonthlyCloses } from "@/features/backtesting/monthly";
import { addMonths, BacktestDataError, monthRange, type CalendarMonth } from "@/features/backtesting/spec";
import { chartPoints } from "@/features/instruments/history";
import { adjustmentPolicies, type Currency } from "@/features/market-data/contracts";
import type { MarketDataService } from "@/features/market-data/service";
import { priceToDecimal, priceUnitsFromNumber } from "@/features/portfolio/decimal";

export type TrainingSource =
  | { kind: "model" }
  | { kind: "history"; sourceName: string; symbol: string; instrumentName: string; sample: boolean; currency: Currency; retrievedAt: string };

/** Frozen at the session start, so a replay never depends on later provider data. */
export interface TrainingSeries {
  points: { date: string; price: string }[];
  source: TrainingSource;
}

export interface TrainingScenario {
  id: string;
  title: string;
  description: string;
  kind: "model" | "history";
  /** History only: the month whose close starts the session, and the last month. */
  startMonth?: CalendarMonth;
  endMonth?: CalendarMonth;
}

/** −30 % over six months, back to the start after ten more, then a slow rise. Levels are exact. */
const MODEL_LEVELS = ["100", "94", "88", "83", "78", "74", "70", "72", "75", "78", "81", "84", "87", "90", "93", "96", "100", "102", "104", "106", "108", "110", "112", "114", "116"];
// The model's calendar is arbitrary; it only fixes month lengths for MWR/TWR and the calendar rebalancing month.
const MODEL_START_MONTH = "2000-01";

export const trainingScenarios: readonly TrainingScenario[] = [
  { id: "model-crisis-v1", kind: "model", title: "Modelová krize", description: "Index za šest měsíců spadne o 30 %, pak se postupně zotaví. Vymyšlená řada pro nácvik, ne předpověď." },
  { id: "history-2008-v1", kind: "history", startMonth: "2007-12", endMonth: "2009-12", title: "Finanční krize 2008", description: "24 měsíců od prosince 2007: propad trhu a začátek zotavení." },
  { id: "history-2020-v1", kind: "history", startMonth: "2019-12", endMonth: "2021-12", title: "Pandemie 2020", description: "24 měsíců od prosince 2019: rychlý pád na jaře 2020 a rychlý návrat." },
  { id: "history-2022-v1", kind: "history", startMonth: "2021-12", endMonth: "2023-12", title: "Inflace a sazby 2022", description: "24 měsíců od prosince 2021: pomalý pokles během roku 2022 a zotavení v roce 2023." },
];

/** History scenarios only where the configured backtest plan loads the whole window. */
export function availableScenarios(plan: BacktestHistoryPlan) {
  return trainingScenarios.filter(({ kind, startMonth, endMonth }) => kind === "model"
    || (startMonth! >= plan.fetchStartDate.slice(0, 7) && endMonth! <= plan.fetchEndDate.slice(0, 7)));
}

const monthEndDate = (month: CalendarMonth) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);

export function modelSeries(): TrainingSeries {
  return { points: MODEL_LEVELS.map((price, index) => ({ date: monthEndDate(addMonths(MODEL_START_MONTH, index)), price })), source: { kind: "model" } };
}

/**
 * Month-end closes of the plan's instrument through MarketDataService, rebased to an index of 100 in
 * CZK: price return only, without dividends and without the CZK/USD rate. A missing month is refused.
 */
export async function loadScenarioSeries(service: MarketDataService, plan: BacktestHistoryPlan, scenarioId: string): Promise<TrainingSeries> {
  const scenario = availableScenarios(plan).find(({ id }) => id === scenarioId);
  if (!scenario) throw new BacktestDataError("Tento scénář není s dostupnými daty k dispozici. Vyber jiný.", "unavailable");
  if (scenario.kind === "model") return modelSeries();
  const { instrumentId, symbol, name } = plan.instrument;
  // The backtest plan's window shares one cached request with Backtesting Lab.
  const request = { instrumentId, startDate: plan.fetchStartDate, endDate: plan.fetchEndDate, interval: "daily" as const, timeZone: "UTC" as const, adjustment: adjustmentPolicies["split-adjusted"] };
  const series = await service.getHistoricalPrices(request);
  if (series.adjustment.mode !== "split-adjusted") throw new BacktestDataError(`Cenová historie ${symbol} nemá očekávanou sémantiku (jen cena bez dividend). Nácvik jsme nespustili.`, "unavailable");
  const points = series.instrumentId === instrumentId ? chartPoints(series, request.startDate, request.endDate) : [];
  const months = monthRange(scenario.startMonth!, scenario.endMonth!);
  const [closes] = alignMonthlyCloses([{ label: symbol, points }], months).closes;
  return {
    points: months.map((month, index) => ({ date: monthEndDate(month), price: priceToDecimal(priceUnitsFromNumber(100 * closes[index] / closes[0])) })),
    source: { kind: "history", sourceName: plan.sourceName, symbol, instrumentName: name, currency: series.currency, retrievedAt: series.provenance.retrievedAt,
      sample: plan.sample || series.provenance.isDeterministic || series.provenance.dataKind !== "historical" },
  };
}
