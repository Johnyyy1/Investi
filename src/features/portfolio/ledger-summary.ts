import "server-only";

import { foldTrades } from "./domain";
import { loadPortfolioRows } from "./repository";

export interface PortfolioLedgerSummary {
  openedAt: string;
  earnedPracticeCapitalMinor: string;
  availableCashMinor: string;
  holdingsCount: number;
  tradeCount: number;
  lastTrade: { side: "BUY" | "SELL"; symbol: string; executedAt: string } | null;
}

/** Saved ledger facts only. No quote or FX is requested, so nothing here is a valuation;
 * cash and holdings use the same fold as loadPortfolioView. */
export async function loadPortfolioLedgerSummary(userId: string): Promise<PortfolioLedgerSummary> {
  const rows = await loadPortfolioRows(userId);
  const folded = foldTrades(rows.earnedPracticeCapitalMinor, rows.trades);
  const last = rows.trades.at(-1);
  return {
    openedAt: rows.portfolio.openedAt.toISOString(),
    earnedPracticeCapitalMinor: rows.earnedPracticeCapitalMinor.toString(),
    availableCashMinor: folded.cashMinor.toString(),
    holdingsCount: folded.holdings.length,
    tradeCount: rows.trades.length,
    lastTrade: last ? { side: last.side, symbol: last.instrumentSymbol, executedAt: last.executedAt.toISOString() } : null,
  };
}
