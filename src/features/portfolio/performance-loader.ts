import "server-only";

import { adjustmentPolicies, type Currency, type HistoricalSeries } from "@/features/market-data/contracts";
import type { MarketDataService } from "@/features/market-data/service";
import { fxUnitsFromNumber, grossBaseMinor, priceUnitsFromNumber } from "./decimal";
import { foldTrades, type LedgerTrade } from "./domain";
import {
  generationContributions, moneyWeightedReturn, PERFORMANCE_DAY_MS, timeWeightedReturn,
  unavailablePerformance, type Contribution, type PortfolioPerformance,
} from "./performance";

type DatedTrade = LedgerTrade & { executedAt: Date; quoteCurrency: string };
interface PerformanceInput {
  openedAt: string;
  openingCapitalMinor: bigint;
  earnedPracticeCapitalMinor: bigint;
  receipts: readonly Contribution[];
  trades: readonly DatedTrade[];
  endingMinor: bigint | null;
  endedAt: string;
  baseCurrency: Currency;
}

/** Read-only reconstruction. Prior complete UTC-day closes are explicitly estimates,
 * not intraday snapshots. No current quote, sample fallback or adjusted price is used
 * to fill a missing historical boundary. */
export async function loadPortfolioPerformance(service: Pick<MarketDataService, "getHistoricalPrices" | "getFxRate">, input: PerformanceInput): Promise<PortfolioPerformance> {
  const flows = generationContributions(input.openedAt, input.openingCapitalMinor, input.receipts);
  const startedAt = flows[0]?.at ?? input.openedAt;
  const result: PortfolioPerformance = {
    startedAt, endedAt: input.endedAt, twrMethod: "cash-flow-boundaries",
    twr: unavailablePerformance("no-capital"), mwr: unavailablePerformance("no-capital"),
  };
  if (flows.reduce((sum, flow) => sum + flow.amountMinor, 0n) !== input.earnedPracticeCapitalMinor
    || input.trades.some((trade) => trade.executedAt.toISOString() < input.openedAt || trade.executedAt.toISOString() > input.endedAt)
    || flows.some((flow) => flow.at > input.endedAt)) {
    result.twr = result.mwr = unavailablePerformance("invalid-ledger");
    return result;
  }
  result.mwr = moneyWeightedReturn(flows, input.endedAt, input.endingMinor);
  if (!flows.length) return result;
  if (input.endingMinor === null) { result.twr = unavailablePerformance("missing-valuation"); return result; }
  const boundaries: { amountMinor: bigint; valueBeforeMinor: bigint | null }[] = [];
  const history = new Map<string, Promise<HistoricalSeries>>();
  const fx = new Map<string, ReturnType<MarketDataService["getFxRate"]>>();
  for (const flow of flows.slice(1)) {
    const earlier = input.trades.filter((trade) => trade.executedAt.toISOString() < flow.at);
    const contributedBefore = flows.filter(({ at }) => at < flow.at).reduce((sum, { amountMinor }) => sum + amountMinor, 0n);
    const folded = foldTrades(contributedBefore, earlier);
    let before: bigint | null = folded.cashMinor;
    if (input.trades.some((trade) => trade.executedAt.toISOString() === flow.at)) before = null; // no authoritative same-instant event order
    if (folded.holdings.length) {
      result.twrMethod = "prior-daily-close-estimate";
      try {
        const endDate = new Date(Date.parse(flow.at) - PERFORMANCE_DAY_MS).toISOString().slice(0, 10);
        const startDate = new Date(Date.parse(flow.at) - 8 * PERFORMANCE_DAY_MS).toISOString().slice(0, 10);
        const values = await Promise.all(folded.holdings.map(async (holding) => {
          const currency = earlier.find((trade) => trade.instrumentId === holding.instrumentId)!.quoteCurrency as Currency;
          // One range per instrument, reused across all contribution boundaries.
          const key = holding.instrumentId;
          const historyStart = new Date(Date.parse(flows[1].at) - 8 * PERFORMANCE_DAY_MS).toISOString().slice(0, 10);
          const historyEnd = new Date(Date.parse(flows.at(-1)!.at) - PERFORMANCE_DAY_MS).toISOString().slice(0, 10);
          if (!history.has(key)) history.set(key, service.getHistoricalPrices({ instrumentId: holding.instrumentId, startDate: historyStart, endDate: historyEnd, interval: "daily", timeZone: "UTC", adjustment: adjustmentPolicies.raw }));
          const series = await history.get(key)!;
          // A partial series may omit the most recent session. Never guess which gap is harmless.
          if (series.instrumentId !== holding.instrumentId || series.currency !== currency || series.adjustment.mode !== "raw" || series.provenance.completeness !== "complete") throw new Error("Incomplete history");
          const point = series.points.filter(({ date }) => date >= startDate && date <= endDate).toSorted((a, b) => a.date.localeCompare(b.date)).at(-1);
          if (!point || Date.parse(flow.at) - Date.parse(point.date) > 7 * PERFORMANCE_DAY_MS || !Number.isFinite(point.close) || point.close <= 0) throw new Error("Missing close");
          const asOf = `${point.date}T23:59:59.999Z`;
          const fxKey = JSON.stringify([currency, input.baseCurrency, point.date]);
          if (!fx.has(fxKey)) fx.set(fxKey, service.getFxRate(currency, input.baseCurrency, asOf));
          const rate = await fx.get(fxKey)!;
          if (rate.baseCurrency !== currency || rate.quoteCurrency !== input.baseCurrency || rate.referenceDate > point.date || Date.parse(point.date) - Date.parse(rate.referenceDate) > 7 * PERFORMANCE_DAY_MS || rate.provenance.completeness !== "complete") throw new Error("Missing historical FX");
          return grossBaseMinor(holding.quantityUnits, priceUnitsFromNumber(point.close), fxUnitsFromNumber(rate.rate));
        }));
        if (before !== null) before += values.reduce((sum, value) => sum + value, 0n);
      } catch {
        before = null;
      }
    }
    boundaries.push({ amountMinor: flow.amountMinor, valueBeforeMinor: before });
    if (before === null) break;
  }
  result.twr = timeWeightedReturn(flows[0].amountMinor, boundaries, input.endingMinor, (Date.parse(input.endedAt) - Date.parse(startedAt)) / PERFORMANCE_DAY_MS);
  return result;
}
