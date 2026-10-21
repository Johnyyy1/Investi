"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TradeReviewView } from "@/features/portfolio/costs";
import { fxRateLabel, portfolioDataSourceLabel } from "@/features/portfolio/presentation";
import type { InstrumentPreview } from "@/features/portfolio/service";
import { formatPercentage } from "@/lib/formatters";
import { formatPracticeCapitalMinor } from "@/features/rewards/presentation";

function quantityLabel(value: string) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 8 }).format(Number(value));
}
function quotePrice(value: string, currency: string) {
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 8 }).format(Number(value))} ${currency}`;
}
function assetTypeLabel(value: string) {
  if (value === "equity") return "Akcie";
  if (value === "etf") return "ETF";
  if (value === "bond") return "Dluhopis";
  if (value === "cash") return "Hotovost";
  if (value === "index") return "Index";
  return "Instrument";
}

export function BuyReview({ preview, quantity, cost, side, availableCash, onBack }: { preview: InstrumentPreview; quantity: string; cost: TradeReviewView; side: "BUY" | "SELL"; availableCash: string; onBack: () => void }) {
  return <section aria-labelledby="buy-review-title">
    <Button variant="ghost" size="compact" className="mb-5" onClick={onBack}><ArrowLeft aria-hidden="true" className="size-4" />Upravit pokyn</Button>
    <h3 id="buy-review-title" tabIndex={-1} className="text-section-title font-bold">{side === "BUY" ? "Zkontroluj investici" : "Zkontroluj prodej"}</h3>
    <p className="mt-2 text-body text-secondary">Náklady snižují hotovost i výsledek investice.</p>
    <div className="mt-6 overflow-hidden rounded-surface border border-border">
      <div className="bg-surface-muted px-5 py-4"><p className="break-words font-bold">{preview.instrument.name}</p><p className="break-words text-small text-secondary">{preview.instrument.symbol} · {assetTypeLabel(preview.instrument.assetType)} · {portfolioDataSourceLabel(preview.marketDataMode)}</p></div>
      <dl className="divide-y divide-border px-5 text-small">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Množství</dt><dd className="min-w-0 break-words text-right font-bold tabular-nums">{quantityLabel(quantity)}</dd></div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Pozorovaná referenční cena</dt><dd className="min-w-0 break-words text-right font-bold tabular-nums">{quotePrice(cost.price, preview.instrument.quoteCurrency)}</dd></div>
        {preview.instrument.quoteCurrency !== "CZK" ? <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Referenční kurz</dt><dd className="min-w-0 break-words text-right font-bold tabular-nums">{fxRateLabel(cost.fxProvider, cost.referenceFxRate, preview.instrument.quoteCurrency, cost.fxReferenceDate)}</dd></div> : null}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Fiktivní profil brokera</dt><dd className="min-w-0 break-words text-right font-bold">{cost.feeProfileName}</dd></div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Hodnota bez nákladů</dt><dd className="min-w-0 break-words text-right font-bold tabular-nums">{formatPracticeCapitalMinor(cost.referenceGrossAmountBaseMinor)}</dd></div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Poplatek za obchod</dt><dd data-testid="review-trade-fee" className="min-w-0 break-words text-right font-bold tabular-nums">{formatPracticeCapitalMinor(cost.feeBaseMinor)}</dd></div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Přirážka konverze ({formatPercentage(cost.fxMarkupBps / 10_000)})</dt><dd data-testid="review-fx-cost" className="min-w-0 break-words text-right font-bold tabular-nums">{formatPracticeCapitalMinor(cost.fxMarkupBaseMinor)}</dd></div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Náklady celkem</dt><dd data-testid="review-total-cost" className="min-w-0 break-words text-right font-bold tabular-nums">{formatPracticeCapitalMinor(cost.totalCostBaseMinor)}</dd></div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">{side === "BUY" ? "Celkem zaplatíš (odhad)" : "Čistý příjem z prodeje (odhad)"}</dt><dd data-testid="review-cash-delta" className="min-w-0 break-words text-right font-bold tabular-nums">{formatPracticeCapitalMinor(side === "BUY" ? -BigInt(cost.cashDeltaBaseMinor) : cost.cashDeltaBaseMinor)}</dd></div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Dostupná hotovost</dt><dd className="min-w-0 break-words text-right font-bold tabular-nums">{formatPracticeCapitalMinor(availableCash)}</dd></div>
      </dl>
    </div>
    <p className="mt-5 break-words text-small text-secondary">Fiktivní ceník pro výuku. Konverze používá referenční kurz s uvedenou přirážkou: nákup je dražší, prodej přinese méně korun. Bid/ask spread, skluz ani úschovu nemodelujeme. Server při potvrzení znovu ověří cenu, kurz a náklady; konečné hodnoty se mohou lišit.</p>
  </section>;
}
