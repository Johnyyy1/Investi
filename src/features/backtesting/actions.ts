"use server";

import { z } from "zod";
import { FinancialInputError } from "@/features/finance/returns";
import { isMarketDataError } from "@/features/market-data/errors";
import { portfolioMarketData } from "@/features/portfolio/environment";
import { enforceMarketDataBudget } from "@/features/rate-limit";
import { isRequestRateLimitedError } from "@/features/rate-limit/limiter";
import { marketDataLimitMessage } from "@/features/rate-limit/policy";
import { getCurrentUser } from "@/lib/session";
import { backtestHistoryPlans, type HistoryBacktestResult } from "./catalog";
import { runHistoryBacktests } from "./run";
import { BacktestDataError, rebalanceRules } from "./spec";

/** The browser sends only choices from the catalog; prices, values and results come from the server. */
const inputSchema = z.object({
  strategy: z.string().min(1).max(40),
  benchmark: z.string().min(1).max(80),
  rebalance: z.enum(rebalanceRules),
  amount: z.string().max(40),
  costs: z.object({ rate: z.string().max(20), fixedFee: z.string().max(20) }).nullable().optional(),
  periods: z.array(z.object({ start: z.number().int(), end: z.number().int() })).min(1).max(4),
});

type HistoryBacktestResponse = { ok: true; results: HistoryBacktestResult[] } | { ok: false; message: string };

function messageFor(error: unknown) {
  if (error instanceof FinancialInputError || error instanceof BacktestDataError) return error.message;
  if (isRequestRateLimitedError(error)) return marketDataLimitMessage(error.decision);
  if (error instanceof z.ZodError) return "Nastavení backtestu se nepodařilo přečíst. Zkontroluj ho a zkus to znovu.";
  if (isMarketDataError(error) && error.code === "RateLimited") return "Tržní data jsou dočasně omezená. Zkus to za chvíli znovu.";
  return "Cenová historie teď není dostupná. Backtest jsme nespustili, zkus to za chvíli znovu.";
}

/** Runs a history backtest. It reads market data only: Practice Capital and the portfolio stay untouched. */
export async function runHistoryBacktestAction(input: unknown): Promise<HistoryBacktestResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Relace skončila. Přihlas se znovu a spusť backtest." };
    const request = inputSchema.parse(input);
    await enforceMarketDataBudget(user.id, "backtest");
    const results = await runHistoryBacktests(portfolioMarketData.service, backtestHistoryPlans[portfolioMarketData.provider], request);
    return { ok: true, results };
  } catch (error) {
    if (!(error instanceof FinancialInputError || error instanceof z.ZodError || isRequestRateLimitedError(error))) {
      console.error("[backtest-history] run failed", { error: isMarketDataError(error) ? { code: error.code, message: error.message, context: error.context } : error instanceof BacktestDataError ? { reason: error.reason, message: error.message } : error });
    }
    return { ok: false, message: messageFor(error) };
  }
}
