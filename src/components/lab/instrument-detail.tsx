"use client";

import Link from "next/link";
import { Check, ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type MouseEvent } from "react";
import { BuyReview } from "@/components/lab/buy-review";
import { InstrumentPriceChart } from "@/components/lab/instrument-price-chart";
import { InstrumentReturnAnalytics } from "@/components/lab/instrument-return-analytics";
import { EquityKeyMetrics } from "@/components/lab/equity-key-metrics";
import { EtfAnalytics } from "@/components/lab/etf-analytics";
import { Button, IconButton } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form-controls";
import type { ChartRange } from "@/features/instruments/history";
import type { PriceMetrics } from "@/features/instruments/price-metrics";
import type { HistoricalPricePoint, Instrument, MarketSessionState, QuoteUsabilityStatus } from "@/features/market-data/contracts";
import type { EquityFundamentalsSnapshot } from "@/features/market-data/equity-fundamentals";
import type { EtfAnalyticsSnapshot } from "@/features/market-data/etf-analytics";
import { buyPortfolioAction, loadInstrumentPreviewAction, sellPortfolioAction } from "@/features/portfolio/actions";
import { parseQuantity, roundDivide } from "@/features/portfolio/decimal";
import { gainLossState, showSampleDataIndicator } from "@/features/portfolio/presentation";
import { estimatedMinor, parseQuantitySafe } from "@/features/portfolio/order-presentation";
import type { InstrumentPreview, PortfolioView } from "@/features/portfolio/service";
import { formatPracticeCapitalMinor } from "@/features/rewards/presentation";
import { formatPercentage } from "@/lib/formatters";

type QuoteView = { price: number; observedAt: string; status: QuoteUsabilityStatus; marketState: MarketSessionState };
type Holding = PortfolioView["holdings"][number];
type HomeCurrency = { rate: number; referenceDate: string } | null;

function dateTime(value: string) { return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function nativePrice(value: number, currency: string) { return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 8 }).format(value)} ${currency}`; }
function quantity(value: string) { return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 8 }).format(Number(value)); }
const assetTypeLabels: Record<Instrument["assetType"], string> = {
  equity: "Akcie",
  etf: "ETF",
  bond: "Dluhopis",
  cash: "Hotovost",
  index: "Index",
};
const assetEyebrows: Record<Instrument["assetType"], string> = {
  equity: "Akcie · jedna firma",
  etf: "ETF · koš aktiv",
  bond: "Dluhopis",
  cash: "Hotovost",
  index: "Index",
};
function assetTypeLabel(value: Instrument["assetType"]) { return assetTypeLabels[value]; }
type QuoteTone = "success" | "warning" | "neutral";
function quoteState(quote: QuoteView): { label: string; tone: QuoteTone } | null {
  if (quote.status === "unavailable") return { label: "Cena není dostupná", tone: "warning" };
  if (quote.status === "stale") return { label: "Zastaralá cena", tone: "warning" };
  if (quote.marketState === "closed" || quote.status === "closed-market-reference") return { label: "Trh zavřen", tone: "neutral" };
  if (quote.marketState === "open") return { label: "Aktuální cena", tone: "success" };
  return null;
}
const toneClass: Record<QuoteTone, string> = {
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  neutral: "bg-surface-muted text-secondary",
};
function signedMoney(value: string | null) {
  if (value === null) return "Nedostupné";
  return `${BigInt(value) > 0n ? "+" : ""}${formatPracticeCapitalMinor(value)}`;
}
function sellEstimate(holding: Holding, amount: string) {
  if (holding.marketValueMinor === null) return null;
  try { return roundDivide(BigInt(holding.marketValueMinor) * parseQuantity(amount), parseQuantity(holding.quantity)); }
  catch { return null; }
}
function czkValue(price: number, homeCurrency: NonNullable<HomeCurrency>) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(price * homeCurrency.rate);
}
function referenceDateLabel(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

export function InstrumentDetailView({ instrument, quote, quoteMessage, points, historyMessage, historyPartial, metrics, homeCurrency, homeCurrencyMessage, fundamentals, fundamentalsMessage, etfAnalytics, etfAnalyticsMessage, range, portfolio: initialPortfolio }: { instrument: Instrument; quote: QuoteView | null; quoteMessage: string | null; points: HistoricalPricePoint[]; historyMessage: string | null; historyPartial: boolean; metrics: PriceMetrics | null; homeCurrency: HomeCurrency; homeCurrencyMessage: string | null; fundamentals: EquityFundamentalsSnapshot | null; fundamentalsMessage: string | null; etfAnalytics: EtfAnalyticsSnapshot | null; etfAnalyticsMessage: string | null; range: ChartRange; portfolio: PortfolioView }) {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [preview, setPreview] = useState<InstrumentPreview | null>(null);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [amount, setAmount] = useState("0.25");
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingPreview, startPreview] = useTransition();
  const [pending, startTrade] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const orderHeading = useRef<HTMLHeadingElement>(null);
  const tradeKey = useRef<string | null>(null);
  const holding = portfolio.holdings.find((item) => item.instrumentId === instrument.instrumentId);
  const buyEstimate = preview ? estimatedMinor(amount, preview.estimatedUnitCostBaseMinor) : null;
  const estimatedProceeds = holding ? sellEstimate(holding, amount) : null;
  const canInvest = BigInt(portfolio.earnedPracticeCapitalMinor) > 0n && instrument.assetType !== "cash" && instrument.assetType !== "index";
  const state = quote ? quoteState(quote) : null;
  const priceCurrency = instrument.quoteCurrency;

  function closeDialog() { if (!pending) dialog.current?.close(); }
  function openBuy(event: MouseEvent<HTMLButtonElement>) {
    trigger.current = event.currentTarget;
    setSide("BUY"); setPreview(null); setAmount("0.25"); setError(null); setReviewing(false); tradeKey.current = null;
    dialog.current?.showModal();
    startPreview(async () => {
      const response = await loadInstrumentPreviewAction(instrument.instrumentId);
      if (response.ok) { setPreview(response.preview); requestAnimationFrame(() => orderHeading.current?.focus()); }
      else setError(response.message);
    });
  }
  function openSell(event: MouseEvent<HTMLButtonElement>) {
    if (!holding) return;
    trigger.current = event.currentTarget;
    setSide("SELL"); setAmount(holding.quantity); setError(null); setReviewing(false); tradeKey.current = null;
    dialog.current?.showModal();
  }
  function execute() {
    if (pending) return;
    tradeKey.current ??= crypto.randomUUID();
    const completedAmount = amount;
    startTrade(async () => {
      const action = side === "BUY" ? buyPortfolioAction : sellPortfolioAction;
      const response = await action({ instrumentId: instrument.instrumentId, quantity: completedAmount, clientIdempotencyKey: tradeKey.current });
      if (!response.ok) { setError(response.message); return; }
      setPortfolio(response.portfolio);
      setNotice(`${side === "BUY" ? "Nákup dokončen" : "Prodej dokončen"} · ${quantity(completedAmount)} ${instrument.symbol}`);
      tradeKey.current = null;
      dialog.current?.close();
      router.refresh();
    });
  }

  return <>
    <header className="mt-3 pb-6 sm:mt-5 sm:pb-7">
      <p className="text-microcopy font-bold uppercase tracking-[0.12em] text-primary-hover">{assetEyebrows[instrument.assetType]}</p>
      <div className="mt-2 flex min-w-0 flex-wrap items-start justify-between gap-x-6 gap-y-5">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-3"><h1 className="min-w-0 wrap-anywhere text-page-title font-bold tracking-[-0.025em]">{instrument.name}</h1>{showSampleDataIndicator(portfolio.marketDataMode) ? <span className="rounded-control border border-border bg-surface-muted px-2.5 py-1 text-microcopy font-semibold text-secondary">Ukázková data</span> : null}</div>
          <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-small text-secondary"><span className="rounded-control bg-surface-muted px-2 py-0.5 font-bold text-foreground tabular-nums">{instrument.symbol}</span><span className="min-w-0 wrap-anywhere">{assetTypeLabel(instrument.assetType)}{instrument.exchangeMic ? ` · burza ${instrument.exchangeMic}` : ""} · obchoduje se v {instrument.quoteCurrency}</span></p>
        </div>
        {canInvest ? <Button onClick={openBuy} className="hidden sm:inline-flex sm:w-auto">Koupit {instrument.symbol}</Button> : null}
      </div>
    </header>

    {notice ? <Feedback state="completed" role="status" className="mb-5 flex items-center justify-between gap-3"><span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="flex items-center gap-2"><Check aria-hidden="true" className="size-5 text-success-ink" />{notice}</span><Link href="/lab/portfolio" className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary-hover underline-offset-4 hover:underline">Zobrazit portfolio <ChevronRight aria-hidden="true" className="size-4" /></Link></span><IconButton aria-label="Zavřít potvrzení" variant="ghost" className="size-10 min-h-0 p-0" onClick={() => setNotice(null)}><X aria-hidden="true" /></IconButton></Feedback> : null}

    <section aria-labelledby="price-heading" className="grid gap-5 rounded-panel border border-border bg-surface p-5 shadow-elevation-1 sm:p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <h2 id="price-heading" className="sr-only">Cena instrumentu</h2>
      {quote && quote.status !== "unavailable" ? <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3"><p className="text-small text-secondary">Cena jedné {instrument.assetType === "equity" ? "akcie" : "jednotky"} · {instrument.exchangeMic ?? "burza neuvedena"}</p>{state ? <span className={`inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-microcopy font-bold ${toneClass[state.tone]}`}>{state.label}</span> : null}</div>
        <p className="mt-2 break-words text-[clamp(2.25rem,5vw,3.25rem)] leading-tight font-bold tracking-[-0.035em] tabular-nums">{nativePrice(quote.price, priceCurrency)}</p>
        <p className="mt-2 text-small text-secondary">Poslední dostupná cena {dateTime(quote.observedAt)}{quote.status === "stale" ? " · může být zastaralá" : ""}</p>
      </div> : <div className="min-w-0"><p className="text-small text-secondary">Cena</p><p role="status" className="mt-2 text-small text-secondary">{quoteMessage ?? "Aktuální tržní cena není dostupná."}</p></div>}
      <div className="min-w-0 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <p className="text-small text-secondary">Přepočet do korun</p>
        {quote && quote.status !== "unavailable" && homeCurrency && priceCurrency !== "CZK" ? <>
          <p className="mt-2 text-[clamp(1.75rem,3.5vw,2.25rem)] leading-tight font-bold tracking-[-0.02em] tabular-nums">≈ {czkValue(quote.price, homeCurrency)} Kč</p>
          <p className="mt-2 text-microcopy text-secondary">Orientační přepočet · referenční kurz k {referenceDateLabel(homeCurrency.referenceDate)} · 1 {priceCurrency} = {new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(homeCurrency.rate)} Kč</p>
        </> : priceCurrency === "CZK" && quote && quote.status !== "unavailable" ? <p className="mt-2 text-small text-secondary">Cena je už v korunách.</p> : <p role="status" className="mt-2 text-small text-secondary">{homeCurrencyMessage ?? "Přepočet do korun není k dispozici, protože chybí cena."}</p>}
      </div>
    </section>

    <div className="mt-6"><InstrumentPriceChart key={`${instrument.instrumentId}:${range}`} instrumentId={instrument.instrumentId} range={range} points={points} currency={instrument.quoteCurrency} message={historyMessage} partial={historyPartial} metrics={metrics} /></div>

    <div className="mt-6"><InstrumentReturnAnalytics metrics={metrics} currency={instrument.quoteCurrency} /></div>

    {holding ? <section aria-labelledby="position-heading" className="mt-8 border-t border-border pt-7"><div className="flex flex-wrap items-center justify-between gap-4"><h2 id="position-heading" className="text-section-title font-bold">Tvoje pozice</h2><div className="flex w-full flex-wrap gap-2 sm:w-auto">{canInvest ? <Button size="compact" onClick={openBuy}>Koupit další</Button> : null}<Button size="compact" variant="secondary" onClick={openSell}>Prodat</Button></div></div><dl className="mt-5 grid gap-4 text-small sm:grid-cols-4"><div><dt className="text-secondary">Množství</dt><dd className="mt-1 font-bold tabular-nums">{quantity(holding.quantity)} pozic</dd></div><div><dt className="text-secondary">Tržní hodnota</dt><dd className="mt-1 font-bold tabular-nums">{holding.marketValueMinor === null ? "Nedostupné" : formatPracticeCapitalMinor(holding.marketValueMinor)}</dd></div><div><dt className="text-secondary">Zisk / ztráta</dt><dd className={`mt-1 font-bold tabular-nums ${gainLossState(holding.gainLossMinor) === "positive" ? "text-success-ink" : gainLossState(holding.gainLossMinor) === "negative" ? "text-danger-ink" : ""}`}>{signedMoney(holding.gainLossMinor)}</dd></div><div><dt className="text-secondary">Váha v portfoliu</dt><dd className="mt-1 font-bold tabular-nums">{holding.allocationBasisPoints === null ? "Nedostupné" : formatPercentage(Number(holding.allocationBasisPoints) / 10_000)}</dd></div></dl></section> : null}

    <section aria-labelledby="learning-hook-heading" className="mt-8 grid gap-6 border-t border-border pt-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0"><p className="text-microcopy font-bold uppercase tracking-[0.12em] text-primary-hover">Z učení</p><h2 id="learning-hook-heading" className="mt-2 text-section-title font-bold">Rozumíš tomuhle grafu?</h2>
        <ul className="mt-5 grid gap-3 text-small leading-relaxed">
          <li className="flex gap-3"><span aria-hidden="true" className="mt-2 inline-block h-0.5 w-6 shrink-0 bg-primary" /><span>Čára: zavírací cena v jednotlivých dnech, v {priceCurrency}.</span></li>
          <li className="flex gap-3"><span aria-hidden="true" className="mt-2 inline-block h-3 w-6 shrink-0 rounded-sm bg-butter-tint" /><span>Žlutý pruh: největší propad období, pokud byl v datech.</span></li>
          <li className="flex gap-3"><span aria-hidden="true" className="mt-2 inline-block h-0.5 w-6 shrink-0 border-t border-dashed border-control" /><span>Přerušovaná čára: cena na začátku vybraného období.</span></li>
        </ul>
      </div>
      <div className="min-w-0 self-start rounded-panel bg-surface-muted p-5">
        <h3 className="text-card-title font-bold">Co v grafu chybí?</h3>
        <p className="mt-2 text-small leading-relaxed">Dividendy. Akcionář si za období odnesl víc, než ukazuje čára, a proto se cenový výnos liší od celkového.</p>
        <Link href="/learn/returns/comparing-investments" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-control font-semibold text-primary-hover focus-visible:outline-2 focus-visible:outline-primary">Lekce: Cenový a celkový výnos <ChevronRight aria-hidden="true" className="size-4" /></Link>
      </div>
    </section>

    {instrument.assetType === "equity" ? <EquityKeyMetrics snapshot={fundamentals} message={fundamentalsMessage} quoteCurrency={instrument.quoteCurrency} /> : null}
    {instrument.assetType === "etf" ? <EtfAnalytics snapshot={etfAnalytics} message={etfAnalyticsMessage} /> : null}

    <section aria-labelledby="instrument-facts-heading" className="mt-8 border-t border-border pt-7"><h2 id="instrument-facts-heading" className="text-card-title font-bold">Informace o instrumentu</h2><dl className="mt-4 grid gap-4 text-small sm:grid-cols-3"><div><dt className="text-secondary">Typ aktiva</dt><dd className="mt-1 font-semibold">{assetTypeLabel(instrument.assetType)}</dd></div><div><dt className="text-secondary">Burza</dt><dd className="mt-1 font-semibold">{instrument.exchangeMic ?? "Není dostupná"}</dd></div><div><dt className="text-secondary">Měna kotace</dt><dd className="mt-1 font-semibold">{instrument.quoteCurrency}</dd></div></dl></section>

    {canInvest ? <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:hidden"><Button className="w-full" onClick={openBuy}>Koupit {instrument.symbol}</Button></div> : null}

    <dialog ref={dialog} aria-labelledby="instrument-order-title" aria-describedby="instrument-order-description" onClose={() => { setError(null); setReviewing(false); trigger.current?.focus(); requestAnimationFrame(() => trigger.current?.focus()); }} onCancel={(event) => { if (pending) event.preventDefault(); }} className="fixed inset-y-0 right-0 left-auto m-0 h-[100dvh] max-h-none w-full max-w-none overflow-y-auto border-0 border-l border-border bg-surface p-0 text-foreground shadow-elevation-2 backdrop:bg-foreground/35 sm:max-w-[34rem] sm:rounded-l-panel">
      <div className="flex min-h-full flex-col"><div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-border bg-surface/95 px-[min(1.25rem,5vw)] py-5 backdrop-blur sm:px-7"><div className="min-w-0"><p className="text-microcopy font-bold uppercase tracking-[0.12em] text-primary-hover">{side === "BUY" ? reviewing ? "Krok 2 ze 2" : "Krok 1 ze 2" : "Prodat investici"}</p><h2 id="instrument-order-title" className="mt-1 break-words text-card-title font-bold">{side === "BUY" ? `Investovat do ${instrument.symbol}` : `Prodat `}</h2><p id="instrument-order-description" className="sr-only">{side === "BUY" ? "Zvol množství, zkontroluj a potvrď investici." : "Zvol množství k prodeji."}</p></div><IconButton aria-label="Zavřít pokyn" variant="ghost" disabled={pending} onClick={closeDialog}><X aria-hidden="true" /></IconButton></div>
      <div className="flex-1 px-[min(1.25rem,5vw)] py-6 sm:px-7 sm:py-8">{error ? <Feedback state="warning" role="alert" className="mb-5">{error}</Feedback> : null}
        {side === "BUY" && loadingPreview ? <p role="status" className="text-small text-secondary">Načítám aktuální tržní pozorování…</p> : side === "BUY" && !preview ? null : side === "BUY" && reviewing && preview ? <BuyReview preview={preview} quantity={amount} estimate={buyEstimate} availableCash={portfolio.availableCashMinor} onBack={() => { setReviewing(false); setError(null); requestAnimationFrame(() => orderHeading.current?.focus()); }} /> : <><h3 ref={orderHeading} tabIndex={-1} className="text-section-title font-bold focus-visible:outline-none">Zvol množství</h3><p className="mt-2 text-small text-secondary">{instrument.name} · {instrument.symbol}</p><div className="mt-6 rounded-surface bg-surface-muted p-5 text-small"><p className="text-secondary">Poslední tržní cena</p><p className="mt-1 font-bold tabular-nums">{preview ? `${preview.price} ${instrument.quoteCurrency}` : quote && quote.status !== "unavailable" ? nativePrice(quote.price, instrument.quoteCurrency) : "Nedostupné"}</p>{preview && !preview.usableForExecution ? <p role="status" className="mt-3 text-warning-ink">Pro investování je potřeba čerstvé tržní pozorování.</p> : null}</div><label htmlFor="instrument-order-quantity" className="mt-7 block text-small font-bold" >Množství {side === "SELL" ? " k prodeji" : ""}</label><Input id="instrument-order-quantity" inputMode="decimal" className="mt-2 tabular-nums" value={amount} onChange={(event) => { setAmount(event.target.value); setError(null); tradeKey.current = null; }} /><p className="mt-2 text-small text-secondary">Zlomková množství lze zadat až na 8 desetinných míst.</p><dl className="mt-7 border-y border-border py-5 text-small"><div className="flex flex-wrap items-baseline justify-between gap-3"><dt className="text-secondary">{side === "BUY" ? "Odhadovaná hodnota nákupu" : "Odhadovaný výnos"}</dt><dd className="font-bold tabular-nums">{side === "BUY" ? buyEstimate === null ? "—" : formatPracticeCapitalMinor(buyEstimate) : estimatedProceeds === null ? "—" : formatPracticeCapitalMinor(estimatedProceeds)}</dd></div>{side === "BUY" ? <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3"><dt className="text-secondary">Dostupná hotovost</dt><dd className="font-bold tabular-nums">{formatPracticeCapitalMinor(portfolio.availableCashMinor)}</dd></div> : null}</dl>{side === "SELL" ? <p className="mt-5 text-small text-secondary">Zobrazená hodnota je odhad. Server pro simulovaný prodej získá čerstvou referenční cenu instrumentu a referenční kurz FX k danému datu.</p> : null}</>}
      </div>
      {(side === "SELL" && holding || side === "BUY" && preview) ? <div className="sticky bottom-0 z-20 border-t border-border bg-surface/95 px-[min(1.25rem,5vw)] py-4 backdrop-blur sm:px-7">{side === "SELL" ? <Button className="w-full" loading={pending} disabled={!holding?.usableForExecution || estimatedProceeds === null || parseQuantitySafe(amount) <= 0n} onClick={execute}>Prodat {instrument.symbol}</Button> : reviewing ? <Button className="w-full" loading={pending} disabled={!preview?.usableForExecution} onClick={execute}>Potvrdit nákup {instrument.symbol}</Button> : <Button className="w-full" disabled={!preview?.usableForExecution || buyEstimate === null || parseQuantitySafe(amount) <= 0n} onClick={() => setReviewing(true)}>Zkontrolovat pokyn <ChevronRight aria-hidden="true" className="size-4" /></Button>}</div> : null}
      </div>
    </dialog>
  </>;
}
