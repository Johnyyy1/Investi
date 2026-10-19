"use client";

import { useState } from "react";
import { CircleCheck, CircleHelp, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Currency } from "@/features/market-data/contracts";
import type { EquityFundamentalsSnapshot } from "@/features/market-data/equity-fundamentals";
import { formatMagnitude, formatMultiple, formatPercent, formatPerShare } from "@/features/instruments/fundamentals-presentation";
import { equityMetricSignal, type EquityMetricId, type MetricSignal } from "@/features/instruments/fundamentals-signals";

type MetricInput = { id: EquityMetricId; label: string; value: string; explanation: string };
type Metric = MetricInput & { signal: MetricSignal; context?: string };

function group(title: string, metrics: MetricInput[]) {
  return { title, metrics };
}

function dateLabel(value: string) { return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`)); }

const classificationLabels: Readonly<Record<string, string>> = {
  Technology: "Technologie",
  "Consumer devices": "Spotřební elektronika",
  Semiconductors: "Polovodiče",
  US: "USA",
};

function classificationLabel(value: string | null | undefined) {
  return value ? classificationLabels[value] ?? value : null;
}

function metricGroups(snapshot: EquityFundamentalsSnapshot, quoteCurrency: Currency) {
  const { valuation: v, profitability: p, financialHealth: h, businessPerformance: b } = snapshot;
  const rawValues: Record<EquityMetricId, number | null> = {
    "market-cap": v.marketCap, pe: v.peTtm, ps: v.psTtm, pb: v.pbTtm, "ev-ebitda": v.evToEbitdaTtm, "p-fcf": v.priceToFcfTtm,
    "gross-margin": p.grossMarginTtm, "operating-margin": p.operatingMarginTtm, "net-margin": p.netMarginTtm, roe: p.roeTtm, roic: p.roicTtm,
    "debt-equity": h.debtToEquityTtm, "current-ratio": h.currentRatioTtm, "net-debt-ebitda": h.netDebtToEbitdaTtm,
    revenue: b.revenueFy, "net-income": b.netIncomeFy, fcf: b.freeCashFlowFy, eps: b.dilutedEpsFy,
  };
  const groups = [
    group("Ocenění", [
      { id: "market-cap", label: "Tržní kapitalizace", value: formatMagnitude(v.marketCap, quoteCurrency), explanation: "Tržní hodnota všech akcií v oběhu podle firemního profilu poskytovatele." },
      { id: "pe", label: "P/E TTM", value: v.peTtmStatus === "not-meaningful" ? "N/M" : formatMultiple(v.peTtm), explanation: "Cena akcie vůči zisku na akcii za posledních 12 měsíců. N/M znamená, že zisk neumožňuje smysluplný poměr." },
      { id: "ps", label: "P/S TTM", value: formatMultiple(v.psTtm), explanation: "Tržní hodnota vůči tržbám za posledních 12 měsíců." },
      { id: "pb", label: "P/B TTM", value: formatMultiple(v.pbTtm), explanation: "Cena akcie vůči účetní hodnotě na akcii." },
      { id: "ev-ebitda", label: "EV / EBITDA TTM", value: formatMultiple(v.evToEbitdaTtm), explanation: "Hodnota podniku vůči provoznímu zisku před úroky, daněmi a odpisy za posledních 12 měsíců." },
      { id: "p-fcf", label: "Cena / FCF TTM", value: formatMultiple(v.priceToFcfTtm), explanation: "Cena akcie vůči volnému peněžnímu toku na akcii za posledních 12 měsíců." },
    ]),
    group("Ziskovost", [
      { id: "gross-margin", label: "Hrubá marže TTM", value: formatPercent(p.grossMarginTtm), explanation: "Podíl tržeb za posledních 12 měsíců, který zbývá po přímých výrobních nákladech." },
      { id: "operating-margin", label: "Provozní marže TTM", value: formatPercent(p.operatingMarginTtm), explanation: "Podíl tržeb za posledních 12 měsíců vytvořený provozní činností." },
      { id: "net-margin", label: "Čistá marže TTM", value: formatPercent(p.netMarginTtm), explanation: "Podíl tržeb za posledních 12 měsíců, který zůstává jako čistý zisk." },
      { id: "roe", label: "ROE TTM", value: formatPercent(p.roeTtm), explanation: "Zisk za posledních 12 měsíců vůči vlastnímu kapitálu akcionářů." },
      { id: "roic", label: "ROIC TTM", value: formatPercent(p.roicTtm), explanation: "Provozní výnos za posledních 12 měsíců z kapitálu investovaného do firmy." },
    ]),
    group("Finanční zdraví", [
      { id: "debt-equity", label: "Dluh / vlastní kapitál TTM", value: formatMultiple(h.debtToEquityTtm, 2), explanation: "Dluh ve vztahu k vlastnímu kapitálu akcionářů podle poměrů TTM poskytovatele." },
      { id: "current-ratio", label: "Běžná likvidita TTM", value: formatMultiple(h.currentRatioTtm, 2), explanation: "Oběžná aktiva ve vztahu ke krátkodobým závazkům." },
      { id: "net-debt-ebitda", label: "Čistý dluh / EBITDA TTM", value: formatMultiple(h.netDebtToEbitdaTtm, 2), explanation: "Čistý dluh ve vztahu k EBITDA za posledních 12 měsíců. Záporná hodnota může znamenat čistou hotovost." },
    ]),
    group("Poslední fiskální rok", [
      { id: "revenue", label: "Tržby FY", value: formatMagnitude(b.revenueFy, b.reportingCurrency), explanation: "Tržby vykázané za poslední dostupný celý fiskální rok." },
      { id: "net-income", label: "Čistý zisk FY", value: formatMagnitude(b.netIncomeFy, b.reportingCurrency), explanation: "Zisk vykázaný za poslední dostupný celý fiskální rok." },
      { id: "fcf", label: "Volný peněžní tok FY", value: formatMagnitude(b.freeCashFlowFy, b.reportingCurrency), explanation: "Provozní peněžní tok po odečtení kapitálových výdajů za stejný fiskální rok." },
      { id: "eps", label: "Zředěný EPS FY", value: formatPerShare(b.dilutedEpsFy, b.reportingCurrency), explanation: "Zisk na akcii za fiskální rok po zohlednění možného rozředění akcií." },
    ]),
  ];
  return groups.map(({ title, metrics }) => ({ title, metrics: metrics.map((metric): Metric => {
    const presentation = equityMetricSignal(metric.id, rawValues[metric.id], metric.id === "pe" && v.peTtmStatus === "not-meaningful" ? "not-meaningful" : undefined, metric.id === "net-debt-ebitda" && h.netDebtToEbitdaIsNetCash);
    return { ...metric, signal: presentation.signal, context: presentation.context };
  }) }));
}

const signalColor: Record<MetricSignal, string> = {
  neutral: "text-foreground", positive: "font-extrabold text-success-strong", caution: "font-extrabold text-danger-strong", unavailable: "text-secondary", "not-meaningful": "text-secondary",
};

const signalDescription: Record<MetricSignal, string> = {
  neutral: "", positive: "Orientační srovnání: příznivé.", caution: "Orientační srovnání: pozor.", unavailable: "Nedostupné.", "not-meaningful": "Nedává smysl.",
};

const contextLabel: Partial<Record<MetricSignal, string>> = { neutral: "Jak to číst", positive: "Proč příznivé", caution: "Proč pozor" };

function SignalIcon({ signal }: { signal: MetricSignal }) {
  if (signal === "positive") return <CircleCheck aria-hidden="true" className="size-4 shrink-0" />;
  if (signal === "caution") return <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />;
  return null;
}

export function EquityKeyMetrics({ snapshot, message, quoteCurrency }: { snapshot: EquityFundamentalsSnapshot | null; message: string | null; quoteCurrency: Currency }) {
  const [openMetric, setOpenMetric] = useState<string | null>(null);
  const company = snapshot?.company;
  const classification = [company?.sector, company?.industry, company?.country].map(classificationLabel).filter(Boolean).join(" · ");
  return <section aria-labelledby="key-metrics-heading" className="mt-8 border-t border-border pt-7">
    <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2"><h2 id="key-metrics-heading" className="text-section-title font-bold">Klíčové ukazatele</h2>{snapshot ? <p className="text-small text-secondary">Ukazatele TTM · poslední dostupné finanční údaje</p> : null}</div>
    {classification ? <p className="mt-2 text-small text-secondary">{classification}</p> : null}
    {snapshot ? <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-microcopy text-secondary"><span className="inline-flex items-center gap-1.5 font-bold text-success-strong"><CircleCheck aria-hidden="true" className="size-4 shrink-0" />Příznivé</span><span className="inline-flex items-center gap-1.5 font-bold text-danger-strong"><TriangleAlert aria-hidden="true" className="size-4 shrink-0" />Pozor</span><span>Proč? Klikni na označenou hodnotu nebo otazník u ukazatele.</span></p> : null}
    {!snapshot ? <p role="status" className="mt-5 text-small text-secondary">{message ?? "Ukazatele společnosti nejsou nyní dostupné."}</p> : <>
      <div className="mt-6 grid gap-x-10 gap-y-8 lg:grid-cols-2">
        {metricGroups(snapshot, quoteCurrency).map(({ title, metrics }) => <div key={title} className="min-w-0">
          <h3 className="border-b border-border pb-2 text-microcopy font-bold uppercase tracking-[0.1em] text-secondary">{title}</h3>
          <dl className="divide-y divide-border/70">{metrics.map((metric) => {
            const expanded = openMetric === metric.id;
            const helpId = `metric-help-${metric.id}`;
            const toggleHelp = () => setOpenMetric((current) => current === metric.id ? null : metric.id);
            const marked = metric.signal === "positive" || metric.signal === "caution";
            const value = <><SignalIcon signal={metric.signal} />{metric.value}{signalDescription[metric.signal] ? <span className="sr-only"> {signalDescription[metric.signal]}</span> : null}</>;
            return <div key={metric.id} className="grid min-w-0 grid-cols-1 items-start gap-x-4 py-2.5 text-small min-[375px]:grid-cols-[minmax(0,1fr)_auto]">
              <dt className="min-w-0">
                <button type="button" aria-expanded={expanded} aria-controls={helpId} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-left text-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary" onClick={toggleHelp}><span>{metric.label}</span><CircleHelp aria-hidden="true" className="size-3.5 shrink-0 text-primary-hover" /></button>
                <div id={helpId} hidden={!expanded} className="mt-1 max-w-[26rem] space-y-1 text-microcopy leading-relaxed text-secondary"><p>{metric.explanation}</p>{metric.context ? <p><span className="font-bold text-foreground">{contextLabel[metric.signal]}:</span> {metric.context}</p> : null}</div>
              </dt>
              <dd data-metric={metric.id} data-signal={metric.signal} className={`flex min-h-11 items-center gap-1.5 break-words text-left font-bold tabular-nums min-[375px]:max-w-[45vw] min-[375px]:justify-end min-[375px]:text-right sm:max-w-none ${signalColor[metric.signal]}`}>
                {marked ? <Button variant="ghost" size="compact" aria-label={`${metric.label}: ${metric.value}. ${contextLabel[metric.signal]}.`} aria-expanded={expanded} aria-controls={helpId} onClick={toggleHelp} className="min-h-11 min-w-11 gap-1.5 px-0 py-0 text-inherit [font-weight:inherit]">{value}</Button> : value}
              </dd>
            </div>;
          })}</dl>
        </div>)}
      </div>
      <p className="mt-6 text-microcopy leading-relaxed text-secondary">Poměry TTM používají posledních dostupných 12 měsíců. Tržní kapitalizace pochází z profilu společnosti. Údaje za fiskální rok jsou vykázané hodnoty{snapshot.businessPerformance.fiscalYearEnd ? ` za rok končící ${dateLabel(snapshot.businessPerformance.fiscalYearEnd)}` : ""}{snapshot.businessPerformance.filingDate ? `, podané ${dateLabel(snapshot.businessPerformance.filingDate)}` : ""}.</p>
      <p className="mt-2 text-microcopy leading-relaxed text-secondary">Barvy a značky používají orientační vzdělávací rozmezí. Nejde o investiční hodnocení a vhodné hodnoty se liší podle odvětví.</p>
      {snapshot.provenance.unavailableDatasets.length ? <p role="status" className="mt-2 text-microcopy text-secondary">Některé zdrojové datové sady nejsou dostupné: {snapshot.provenance.unavailableDatasets.join(", ")}. Pomlčka znamená nedostupnou hodnotu; N/M znamená, že poměr není smysluplný.</p> : <p className="mt-2 text-microcopy text-secondary">Pomlčka znamená nedostupnou hodnotu; N/M znamená, že poměr není smysluplný.</p>}
    </>}
  </section>;
}
