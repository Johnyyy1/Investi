"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check, CircleAlert, CircleCheck, Info, Plus, Search, X } from "lucide-react";
import type { InstrumentSearchResult } from "@/features/market-data/contracts";
import { MAX_ALLOCATION_LINES } from "@/features/portfolio/allocation";
import {
  loadAllocationQuotesAction, reviewPortfolioAllocationAction, savePortfolioAllocationAction, searchPortfolioInstrumentsAction,
} from "@/features/portfolio/actions";
import type { AllocationQuote, PortfolioView } from "@/features/portfolio/service";
import { formatDecimal } from "@/lib/formatters";
import {
  allocationInput, amountForPercent, clampPercent, fxRate, groupOf, groupOrder, groups, minor, mixCheck, money, quantity,
  weightForNewLine, wholeMoney, type Group, type MixLine,
} from "./lab-model";
import styles from "./mix-builder.module.css";
import lab from "./portfolio-lab.module.css";

type Review = Extract<Awaited<ReturnType<typeof reviewPortfolioAllocationAction>>, { ok: true }>["review"];
type QuoteState = AllocationQuote | "loading" | "failed";
type SearchState = "idle" | "loading" | "results" | "empty" | "error";

const typeLabel = (assetType: string | null) => assetType === "equity" ? "Akcie" : assetType === "etf" ? "ETF" : assetType === "bond" ? "Dluhopis" : "Typ se ověřuje";

function quoteProblem(quote: QuoteState | undefined): string | null {
  if (quote === undefined || quote === "loading") return null;
  if (quote === "failed") return "Cenu se nepodařilo ověřit. Zkus to znovu za chvíli.";
  if (quote.status === "executable") return null;
  if (quote.status === "market-closed") return "Trh je teď zavřený. Nakoupit nebo prodat půjde, až se otevře.";
  if (quote.status === "stale") return "Poslední cena je zastaralá. Nákup teď nejde.";
  if (quote.status === "unsupported") return "Tento nástroj do mixu nepatří. Vyber akcii, ETF nebo dluhopis.";
  return "Cena teď není dostupná. Nákup nejde a cenu neodhadujeme.";
}

export function MixBuilder({ view, initial, quotes: initialQuotes }: {
  view: PortfolioView;
  initial: { lines: MixLine[]; cashPercent: number; source: "saved" | "holdings" | "empty" };
  quotes: AllocationQuote[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState<MixLine[]>(initial.lines);
  const [cashPercent, setCashPercent] = useState(initial.cashPercent);
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>(() => Object.fromEntries(initialQuotes.map((quote) => [quote.instrumentId, quote])));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly InstrumentSearchResult[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewing, startReview] = useTransition();
  const [saving, startSave] = useTransition();
  const [, startSearch] = useTransition();
  const searchRequest = useRef(0);
  const saveKey = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogHeading = useRef<HTMLHeadingElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const statusId = useId();

  const total = view.portfolioTotalMinor === null ? null : minor(view.portfolioTotalMinor);
  const sample = view.marketDataMode === "sample";
  const { check, sum } = mixCheck(lines, cashPercent);
  const heldOutside = view.holdings.filter((holding) => !lines.some((line) => line.instrumentId === holding.instrumentId));
  const involved = [...lines.map(({ instrumentId }) => instrumentId), ...heldOutside.map(({ instrumentId }) => instrumentId)];
  const pendingQuotes = involved.some((instrumentId) => quotes[instrumentId] === undefined || quotes[instrumentId] === "loading");
  const blockedBy = involved.filter((instrumentId) => quoteProblem(quotes[instrumentId]) !== null);
  const blockedSymbol = (instrumentId: string) => lines.find((line) => line.instrumentId === instrumentId)?.symbol ?? view.holdings.find((holding) => holding.instrumentId === instrumentId)?.symbol ?? instrumentId;
  const canSave = total !== null && total > 0n && check === "complete" && blockedBy.length === 0 && !pendingQuotes;

  useEffect(() => {
    const normalized = query.trim();
    const request = ++searchRequest.current;
    if (normalized.length < 2) return;
    const timeout = window.setTimeout(() => startSearch(async () => {
      const response = await searchPortfolioInstrumentsAction(normalized);
      if (request !== searchRequest.current) return;
      setResults(response.results);
      setActiveIndex(response.results.length ? 0 : -1);
      if (!response.ok) { setSearchState("error"); setSearchError(response.message); }
      else setSearchState(response.results.length ? "results" : "empty");
    }), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const groupTotals = useMemo(() => {
    const totals = new Map<Group, number>();
    for (const line of lines) totals.set(groupOf(line.assetType), (totals.get(groupOf(line.assetType)) ?? 0) + line.percent);
    totals.set("cash", cashPercent);
    return groupOrder.map((group) => ({ group, percent: totals.get(group) ?? 0 })).filter(({ group, percent }) => percent > 0 || (group === "cash") || lines.some((line) => groupOf(line.assetType) === group));
  }, [lines, cashPercent]);

  function invalidateReview() { saveKey.current = null; setReview(null); }

  function updateLine(instrumentId: string, percentValue: number) {
    invalidateReview();
    setLines((current) => current.map((line) => line.instrumentId === instrumentId ? { ...line, percent: clampPercent(percentValue) } : line));
  }

  function removeLine(instrumentId: string) {
    invalidateReview();
    setLines((current) => current.filter((line) => line.instrumentId !== instrumentId));
  }

  function fetchQuote(instrumentId: string) {
    setQuotes((current) => ({ ...current, [instrumentId]: "loading" }));
    void loadAllocationQuotesAction([instrumentId]).then((response) => {
      const quote = response.ok ? response.quotes[0] : undefined;
      setQuotes((current) => ({ ...current, [instrumentId]: quote ?? "failed" }));
      const instrument = quote?.instrument;
      if (instrument && (instrument.assetType === "equity" || instrument.assetType === "etf" || instrument.assetType === "bond")) {
        const assetType = instrument.assetType;
        setLines((current) => current.map((line) => line.instrumentId === instrumentId ? { ...line, assetType, name: instrument.name, symbol: instrument.symbol, quoteCurrency: instrument.quoteCurrency } : line));
      }
    });
  }

  function addResult(result: InstrumentSearchResult) {
    if (lines.some((line) => line.instrumentId === result.instrumentId) || lines.length >= MAX_ALLOCATION_LINES) return;
    invalidateReview();
    const assetType = result.assetType === "bond" || result.assetType === "etf" ? result.assetType : "equity";
    setLines((current) => [...current, { instrumentId: result.instrumentId, symbol: result.symbol, name: result.name, assetType, quoteCurrency: result.quoteCurrency, percent: weightForNewLine(current, cashPercent) }]);
    const existing = quotes[result.instrumentId];
    if (existing === undefined || existing === "failed") fetchQuote(result.instrumentId);
  }

  function openReview() {
    if (!canSave) return;
    setReviewError(null);
    setReview(null);
    dialog.current?.showModal();
    startReview(async () => {
      const response = await reviewPortfolioAllocationAction(allocationInput(lines, cashPercent));
      if (!response.ok) { setReviewError(response.message); return; }
      saveKey.current ??= crypto.randomUUID();
      setReview(response.review);
      requestAnimationFrame(() => dialogHeading.current?.focus());
    });
  }

  function confirm() {
    if (saving || !review) return;
    saveKey.current ??= crypto.randomUUID();
    setReviewError(null);
    startSave(async () => {
      const response = await savePortfolioAllocationAction({ ...allocationInput(lines, cashPercent), clientIdempotencyKey: saveKey.current });
      if (!response.ok) { setReviewError(response.message); return; }
      router.push(`/lab/portfolio?ulozeno=${response.duplicate ? "znovu" : response.tradeCount}`);
    });
  }

  const allocatedPercent = Math.min(sum, 100);
  const allocatedMinor = total === null ? null : amountForPercent(total, allocatedPercent);
  const fxNotes = [...new Map(Object.values(quotes).flatMap((quote) => typeof quote === "object" && quote.fxRate && quote.instrument && quote.instrument.quoteCurrency !== "CZK" && lines.some((line) => line.instrumentId === quote.instrumentId) ? [[quote.instrument.quoteCurrency, quote.fxRate] as const] : [])).entries()];
  const statusText = check === "empty" ? "Přidej první nástroj"
    : check === "under" ? `Rozděleno ${sum} % · zbývá ${100 - sum} %`
      : check === "over" ? `Rozděleno ${sum} % · o ${sum - 100} % víc`
        : check === "zero-line" ? "Nástroj s 0 % odeber, nebo mu dej váhu"
          : "Rozděleno 100 %";
  // Lines show their own reason; a holding outside the mix has no row, so its reason is spelled out here.
  const blockedLines = blockedBy.filter((instrumentId) => lines.some((line) => line.instrumentId === instrumentId));
  const blockedOutside = blockedBy.filter((instrumentId) => !lines.some((line) => line.instrumentId === instrumentId));
  const blockedText = total === null ? "Bez cen všech položek nejde mix spočítat."
    : pendingQuotes ? "Ověřuji aktuální ceny…"
      : blockedBy.length ? [
        blockedLines.length ? `Teď nejde nakoupit: ${blockedLines.map(blockedSymbol).join(", ")}. Důvod je u položky.` : "",
        ...blockedOutside.map((instrumentId) => `${blockedSymbol(instrumentId)} (mimo mix, prodalo by se): ${quoteProblem(quotes[instrumentId])}`),
      ].filter(Boolean).join(" ")
        : null;

  return <main className={`investi-theme ${lab.page} ${styles.page}`}>
    <div className={styles.topBar}>
      <Link href="/lab/portfolio" className={styles.back}><ArrowLeft size={22} aria-hidden="true" /><span>Portfolio Lab</span></Link>
      <p className={styles.capital}><span className="sr-only">K rozdělení: </span><span className={lab.num}>{total === null ? "—" : wholeMoney(total)}</span></p>
    </div>
    <div className={styles.workspace}>
    <div className={styles.body}>
      <header className={styles.intro}>
        {sample ? <span className={lab.sampleTag}>Ukázková data</span> : null}
        <h1>{initial.source === "empty" ? "Sestav svůj první mix" : "Uprav mix"}</h1>
        <p>{initial.source === "empty"
          ? <>Rozděl <span className={lab.num}>{total === null ? "kapitál" : wholeMoney(total)}</span> cvičného kapitálu. Uložit půjde, až bude rozděleno 100&nbsp;%.</>
          : <>Rozděluješ celou hodnotu portfolia <span className={lab.num}>{total === null ? "" : wholeMoney(total)}</span>: hotovost i to, co už držíš. Uložit půjde, až bude rozděleno 100&nbsp;%.</>}</p>
      </header>

      <section className={styles.searchBlock} aria-labelledby="add-title">
        <label id="add-title" htmlFor="mix-search" className={styles.label}>Přidat nástroj</label>
        <div className={styles.searchField}>
          <Search size={20} aria-hidden="true" />
          <input
            id="mix-search" role="combobox" aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls="mix-results"
            aria-activedescendant={activeIndex >= 0 && results[activeIndex] ? `mix-option-${activeIndex}` : undefined}
            autoComplete="off" placeholder="Název nebo ticker, např. Apple" value={query}
            onChange={(event) => { const value = event.target.value; searchRequest.current += 1; setQuery(value); setResults([]); setActiveIndex(-1); setSearchError(null); setSearchState(value.trim().length >= 2 ? "loading" : "idle"); }}
            onKeyDown={(event) => {
              if (!results.length) return;
              if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((activeIndex + 1) % results.length); }
              if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((activeIndex - 1 + results.length) % results.length); }
              if (event.key === "Enter" && activeIndex >= 0) { event.preventDefault(); addResult(results[activeIndex]); }
              if (event.key === "Escape") { event.preventDefault(); setResults([]); setActiveIndex(-1); setSearchState("idle"); }
            }}
          />
          {query ? <button type="button" className={styles.clear} aria-label="Vymazat hledání" onClick={() => { searchRequest.current += 1; setQuery(""); setResults([]); setSearchState("idle"); setActiveIndex(-1); }}><X size={20} aria-hidden="true" /></button> : null}
        </div>
        {results.length > 0 ? <div className={styles.results}>
          <p className={lab.meta}>{results.length} {results.length === 1 ? "výsledek" : results.length < 5 ? "výsledky" : "výsledků"} · {sample ? "ukázková data" : "tržní data"}</p>
          <ul id="mix-results" role="listbox" aria-label="Výsledky hledání">{results.map((result, index) => {
            const inMix = lines.some((line) => line.instrumentId === result.instrumentId);
            return <li key={result.instrumentId} id={`mix-option-${index}`} role="option" aria-selected={index === activeIndex} data-in-mix={inMix} className={styles.result}
              onMouseDown={(event) => event.preventDefault()}>
              <span className={lab.chip}>{result.symbol}</span>
              <span className={styles.resultText}><strong>{result.name}</strong><span>{typeLabel(result.assetType)} · {result.quoteCurrency}{result.exchangeMic ?? result.exchangeCode ? ` · ${result.exchangeMic ?? result.exchangeCode}` : ""}</span></span>
              {inMix ? <span className={styles.inMix}><Check size={16} aria-hidden="true" />V mixu</span>
                : <button type="button" tabIndex={-1} className={styles.add} aria-label={`Přidat ${result.symbol} do mixu`} disabled={lines.length >= MAX_ALLOCATION_LINES} onClick={() => addResult(result)}><Plus size={20} aria-hidden="true" /></button>}
            </li>;
          })}</ul>
        </div> : searchState === "loading" ? <p role="status" className={styles.searchNote}>Hledám…</p>
          : searchState === "empty" ? <p role="status" className={styles.searchNote}>Nic jsme nenašli. Zkus jiný název nebo ticker.</p>
            : searchState === "error" ? <p role="alert" className={`${styles.searchNote} ${lab.error}`}>{searchError}</p>
              : <p className={styles.searchNote}>Zadej aspoň dva znaky. Šipkami vybereš, Enter přidá do mixu.</p>}
        {lines.length >= MAX_ALLOCATION_LINES ? <p className={styles.searchNote}>Mix má nejvýš {MAX_ALLOCATION_LINES} nástrojů.</p> : null}
      </section>

      <section className={styles.mix} aria-labelledby="mix-title">
        <div className={styles.mixHead}><h2 id="mix-title" className={styles.label}>Tvůj mix · {lines.length + 1} {lines.length + 1 < 5 ? "položky" : "položek"}</h2><p className={lab.meta}>posuvník nebo procenta</p></div>
        {groupTotals.map(({ group, percent: groupPercent }) => {
          const members = group === "cash" ? [] : lines.filter((line) => groupOf(line.assetType) === group);
          return <div key={group} className={styles.group}>
            <div className={styles.groupHead}><span className={lab.dot} style={{ background: groups[group].color }} aria-hidden="true" /><h3>{groups[group].label}</h3><p className={lab.num}>{groupPercent} % · {total === null ? "—" : wholeMoney(amountForPercent(total, groupPercent))}</p></div>
            {members.map((line) => <MixRow key={line.instrumentId} line={line} color={groups[group].color} total={total} quote={quotes[line.instrumentId]} onChange={(value) => updateLine(line.instrumentId, value)} onRemove={() => removeLine(line.instrumentId)} onRetry={() => fetchQuote(line.instrumentId)} />)}
            {group === "cash" ? <MixRow cash line={{ instrumentId: "cash", symbol: "Kč", name: "Hotovost v korunách", assetType: "equity", quoteCurrency: "CZK", percent: cashPercent }} color={groups.cash.color} total={total} quote={undefined} onChange={(value) => { invalidateReview(); setCashPercent(clampPercent(value)); }} /> : null}
          </div>;
        })}
        {heldOutside.length > 0 ? <p className={lab.note}><Info size={15} aria-hidden="true" /><span>Mimo mix: {heldOutside.map((holding) => holding.symbol).join(", ")}. Při uložení se prodá celé a peníze půjdou podle vah.</span></p> : null}
        {fxNotes.length > 0 ? <p className={styles.fxNote}><Info size={18} aria-hidden="true" /><span>Ceny jsou v {fxNotes.map(([currency]) => currency).join(" a ")}. Hodnotu v korunách přepočítáme {sample ? "ukázkovým" : "referenčním"} kurzem, výsledek proto ovlivní i kurz.</span></p> : null}
      </section>
    </div>

    <aside className={styles.saveBar} aria-label="Kontrola mixu a uložení">
      <div className={styles.saveInner}>
        <div id={statusId} className={styles.check} data-check={check} role="status">
          {check === "complete" ? <CircleCheck size={20} aria-hidden="true" /> : <CircleAlert size={20} aria-hidden="true" />}
          <strong>{statusText}</strong>
          <span className={lab.num}>{allocatedMinor === null || total === null ? "" : `${wholeMoney(allocatedMinor)} z ${wholeMoney(total)}`}</span>
        </div>
        <div className={styles.stack} aria-hidden="true">{groupTotals.filter(({ percent: value }) => value > 0).map(({ group, percent: value }) => <span key={group} style={{ flexGrow: value, background: groups[group].color }} />)}{sum < 100 ? <span style={{ flexGrow: 100 - sum }} className={styles.stackRest} /> : null}</div>
        <ul className={styles.stackLegend} aria-label="Rozdělení podle skupin">{groupTotals.map(({ group, percent: value }) => <li key={group}><span className={lab.dot} style={{ background: groups[group].color, width: 8, height: 8 }} aria-hidden="true" />{groups[group].label} <span className={lab.num}>{value} %</span></li>)}</ul>
        {blockedText && check === "complete" ? <p className={styles.blocked} role="status">{blockedText}</p> : null}
        <button ref={saveButton} type="button" className={`${lab.primary} ${styles.save}`} aria-disabled={!canSave} aria-describedby={statusId} onClick={openReview}>Uložit portfolio<Check size={20} aria-hidden="true" /></button>
        <p className={styles.footnote}>Nákup nanečisto{fxNotes.length ? ` · ${sample ? "ukázkový kurz" : "referenční kurz"} ${fxNotes.map(([currency, rate]) => `${fxRate(rate)} Kč/${currency}`).join(", ")}` : ""} · poplatky zatím 0 Kč</p>
      </div>
    </aside>
    </div>

    <dialog ref={dialog} className={`${lab.dialog} ${styles.review}`} aria-labelledby="review-title" aria-describedby="review-description" onCancel={(event) => { if (saving) event.preventDefault(); }} onClose={() => { setReviewError(null); saveButton.current?.focus(); requestAnimationFrame(() => saveButton.current?.focus()); }}>
      <div className={lab.dialogInner}>
        <h2 id="review-title" ref={dialogHeading} tabIndex={-1}>Zkontroluj mix</h2>
        <p id="review-description">Takhle by se mix nakoupil nanečisto podle současných cen{sample ? " z ukázkových dat" : ""}. Nic se zatím neuložilo.</p>
        {reviewing ? <p role="status" className={lab.meta}>Počítám obchody podle aktuálních cen…</p> : null}
        {reviewError ? <p role="alert" className={lab.error}>{reviewError}</p> : null}
        {review ? <ReviewBody review={review} /> : null}
        <div className={lab.dialogActions}>
          <button type="button" className={lab.secondary} disabled={saving} onClick={() => dialog.current?.close()}>Upravit mix</button>
          <button type="button" className={lab.primary} disabled={!review || saving} aria-busy={saving || undefined} onClick={confirm}>{saving ? "Ukládám…" : "Potvrdit a uložit"}</button>
        </div>
      </div>
    </dialog>
  </main>;
}

function MixRow({ line, color, total, quote, cash = false, onChange, onRemove, onRetry }: {
  line: MixLine; color: string; total: bigint | null; quote: QuoteState | undefined; cash?: boolean;
  onChange: (value: number) => void; onRemove?: () => void; onRetry?: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const problem = cash ? null : quoteProblem(quote);
  const amount = total === null ? "—" : wholeMoney(amountForPercent(total, line.percent));
  const unit = typeof quote === "object" && quote.unitCostBaseMinor ? `1 ks ≈ ${money(quote.unitCostBaseMinor)}` : null;
  const meta = cash ? "bez kurzu a výnosu" : `${groups[groupOf(line.assetType)].meta} · ${line.quoteCurrency}`;
  return <div className={styles.line} data-testid={`mix-line-${line.symbol}`}>
    <div className={styles.lineHead}>
      <span className={styles.lineChip}>{line.symbol}</span>
      <div className={styles.lineText}><strong>{line.name}</strong><span className={lab.num}>{meta} · {amount}{unit ? ` · ${unit}` : ""}</span></div>
      {onRemove ? <button type="button" className={styles.remove} aria-label={`Odebrat ${line.symbol} z mixu`} onClick={onRemove}><X size={20} aria-hidden="true" /></button> : null}
    </div>
    <div className={styles.sliderRow}>
      <input type="range" min={0} max={100} step={1} value={line.percent} className={styles.slider}
        style={{ "--fill": `${line.percent}%`, "--color": color } as React.CSSProperties}
        aria-label={`Váha ${cash ? "hotovosti" : line.symbol}`} aria-valuetext={`${line.percent} %, ${amount}`}
        onChange={(event) => onChange(Number(event.target.value))} />
      <label className={styles.percent}>
        <span className="sr-only">Váha {cash ? "hotovosti" : line.symbol} v procentech</span>
        <input inputMode="numeric" pattern="[0-9]*" value={draft ?? String(line.percent)} className={lab.num}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => { const digits = event.target.value.replace(/[^\d]/g, "").slice(0, 3); const next = digits === "" ? "" : String(clampPercent(Number(digits))); setDraft(next); if (next !== "") onChange(Number(next)); }}
          onBlur={() => setDraft(null)} />
        <span aria-hidden="true">%</span>
      </label>
    </div>
    {quote === "loading" ? <p className={styles.lineNote} role="status">Ověřuji cenu…</p> : null}
    {problem ? <p className={styles.lineProblem} role="status"><CircleAlert size={16} aria-hidden="true" /><span>{problem}</span>{quote === "failed" && onRetry ? <button type="button" className={lab.textLink} onClick={onRetry}>Načíst znovu</button> : null}</p> : null}
  </div>;
}

function ReviewBody({ review }: { review: Review }) {
  const buys = review.trades.filter(({ side }) => side === "BUY");
  const sells = review.trades.filter(({ side }) => side === "SELL");
  const spent = buys.reduce((sum, trade) => sum + minor(trade.grossMinor), 0n);
  const received = sells.reduce((sum, trade) => sum + minor(trade.grossMinor), 0n);
  const sample = review.positions.some(({ isDeterministic }) => isDeterministic);
  return <div className={styles.reviewBody}>
    {review.trades.length === 0 ? <p className={lab.note}><Info size={15} aria-hidden="true" /><span>Žádný obchod: rozdíly proti cíli jsou menší než 1 Kč. Uloží se jen nové cílové váhy.</span></p>
      : <ul className={styles.trades} aria-label="Obchody nanečisto">{[...sells, ...buys].map((trade) => <li key={`${trade.side}-${trade.instrumentId}`} data-testid={`review-${trade.side.toLowerCase()}-${trade.symbol}`}>
        <div><strong>{trade.side === "BUY" ? "Koupit" : "Prodat"} {trade.symbol}</strong><span className={lab.num}>{quantity(trade.quantity)} ks × {formatDecimal(Number(trade.price), { maximumFractionDigits: 4 })} {trade.quoteCurrency}{trade.quoteCurrency === "CZK" ? "" : ` × ${fxRate(trade.fxRate)} Kč`}</span></div>
        <strong className={lab.num}>{trade.side === "BUY" ? "−" : "+"}{money(trade.grossMinor)}</strong>
      </li>)}</ul>}
    <dl className={styles.summary}>
      <div><dt>Rozdělovaná hodnota</dt><dd className={lab.num}>{money(review.totalValueMinor)}</dd></div>
      {sells.length ? <div><dt>Z prodejů</dt><dd className={lab.num}>+{money(received)}</dd></div> : null}
      {buys.length ? <div><dt>Na nákupy</dt><dd className={lab.num}>−{money(spent)}</dd></div> : null}
      <div><dt>Zůstane v hotovosti</dt><dd className={lab.num} data-testid="review-cash">{money(review.resultingCashMinor)}</dd></div>
      <div><dt>Poplatky</dt><dd className={lab.num}>0 Kč</dd></div>
    </dl>
    <p className={lab.meta}>Množství se zaokrouhluje dolů na 8 desetinných míst, zbytek zůstane v hotovosti. Při potvrzení server ceny{sample ? "" : " i kurz"} načte znovu, takže se konečné částky mohou nepatrně lišit. Spread, poplatky ani daně Lab zatím nemodeluje.</p>
  </div>;
}
