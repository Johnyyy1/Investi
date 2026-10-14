"use client";

import { ArrowLeft } from "lucide-react";
import { fxRateLabel, portfolioDataSourceLabel } from "@/features/portfolio/presentation";
import type { InstrumentPreview } from "@/features/portfolio/service";
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

export function BuyReview({ preview, quantity, estimate, availableCash, onBack }: { preview: InstrumentPreview; quantity: string; estimate: bigint | null; availableCash: string; onBack: () => void }) {
  return <section aria-labelledby="buy-review-title">
    <button type="button" className="mb-5 inline-flex min-h-11 items-center gap-2 text-small font-bold text-primary-hover" onClick={onBack}><ArrowLeft aria-hidden="true" className="size-4" />Upravit pokyn</button>
    <h3 id="buy-review-title" className="text-section-title font-bold">Zkontroluj investici</h3>
    <p className="mt-2 text-body text-secondary">Před přidáním do portfolia si zkontroluj podrobnosti.</p>
    <div className="mt-6 overflow-hidden rounded-surface border border-border">
      <div className="bg-surface-muted px-5 py-4"><p className="break-words font-bold">{preview.instrument.name}</p><p className="break-words text-small text-secondary">{preview.instrument.symbol} · {assetTypeLabel(preview.instrument.assetType)} · {portfolioDataSourceLabel(preview.marketDataMode)}</p></div>
      <dl className="divide-y divide-border px-5 text-small">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Množství</dt><dd className="min-w-0 break-words text-right font-bold tabular-nums">{quantityLabel(quantity)}</dd></div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Pozorovaná referenční cena</dt><dd className="min-w-0 break-words text-right font-bold tabular-nums">{quotePrice(preview.price, preview.instrument.quoteCurrency)}</dd></div>
        {preview.fxRate && preview.fxReferenceDate && preview.instrument.quoteCurrency !== "CZK" ? <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Použitý kurz</dt><dd className="min-w-0 break-words text-right font-bold tabular-nums">{fxRateLabel(preview.fxProvider, preview.fxRate, preview.instrument.quoteCurrency, preview.fxReferenceDate)}</dd></div> : null}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Odhadovaná hodnota nákupu v Kč</dt><dd className="min-w-0 break-words text-right font-bold tabular-nums">{estimate === null ? "—" : formatPracticeCapitalMinor(estimate)}</dd></div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 py-4"><dt className="min-w-0 text-secondary">Dostupná hotovost</dt><dd className="min-w-0 break-words text-right font-bold tabular-nums">{formatPracticeCapitalMinor(availableCash)}</dd></div>
      </dl>
    </div>
    <p className="mt-5 break-words text-small text-secondary">Portfolio Lab simuluje okamžité provedení pomocí čerstvé aktuální nebo poslední ceny instrumentu a referenčního kurzu FX k danému datu. Nemodeluje provedení FX u brokera, bid/ask, spread ani skluz; konečné hodnoty se od tohoto odhadu mohou lišit.</p>
  </section>;
}
