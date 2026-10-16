"use client";

import { useState } from "react";
import { LearningChart } from "@/components/learning/learning-chart";
import { Button } from "@/components/ui/button";
import { ConceptCard } from "@/components/learning/concept-card";
import { absoluteChange, simpleReturn } from "@/features/finance/returns";
import { historicalPriceReturns } from "@/features/finance/historical-price-returns";
import { adjustmentPolicies, type HistoricalSeries } from "@/features/market-data/contracts";

// Fixed educational history, not a real instrument or fetched market data.
const history: HistoricalSeries = {
  instrumentId: "educational:returns-adjacency", currency: "CZK", interval: "daily", timeZone: "UTC",
  adjustment: adjustmentPolicies["split-adjusted"],
  points: [
    { date: "2026-01-08", close: 100 },
    { date: "2026-01-09", close: 103 },
    { date: "2026-01-12", close: 101 },
    { date: "2026-01-13", close: 106 },
  ].map((point) => ({ ...point, open: point.close, high: point.close, low: point.close })),
  provenance: {
    provider: "investi-educational", dataset: "returns-adjacency-v1", dataKind: "synthetic",
    isDeterministic: true, isDemo: true, adjustmentMode: "split-adjusted", completeness: "partial",
    observedAt: "2026-01-13T00:00:00.000Z", retrievedAt: "2026-01-13T00:00:00.000Z",
  },
};
const datedReturns = historicalPriceReturns(history);
const prices = history.points.map((point, index) => ({ label: ["P₀", "P₁", "P₂", "P₃"][index], date: point.date, price: point.close }));
const dateFormat = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", timeZone: "UTC" });
const formatDate = (date: string) => dateFormat.format(new Date(`${date}T00:00:00.000Z`));
const decimalFormat = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 4 });

const priceFormat = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 });
const changeFormat = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2, signDisplay: "exceptZero" });
const returnFormat = new Intl.NumberFormat("cs-CZ", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
const formatPrice = (value: number) => priceFormat.format(value);
const formatChange = (value: number) => changeFormat.format(value);
const formatReturn = (value: number) => returnFormat.format(value);

export function PriceSeriesExplorer() {
  const [activePeriod, setActivePeriod] = useState(0);
  if (datedReturns.status !== "ok") return <p role="alert">Ukázková cenová řada není dostupná.</p>;
  const returns = datedReturns.observations;
  const current = prices[activePeriod + 1];
  const previous = prices[activePeriod];
  const currentChange = absoluteChange(previous.price, current.price);
  const observation = returns[activePeriod];
  const currentReturn = observation.returnValue;
  const selectPeriod = (index: number) => <Button variant="ghost" className="min-h-11 px-3" aria-label={`Prohlédnout období ${index + 1}`} aria-pressed={index === activePeriod} onClick={() => setActivePeriod(index)}>Prohlédnout</Button>;

  return <section aria-label="Průzkumník výnosů za období" className="min-w-0 space-y-6">
    <p className="text-small text-secondary">Ukázková cenová řada · pevná data pro výuku · leden 2026 · CZK</p>
    <LearningChart data={prices.map((point) => ({ label: point.label, value: point.price }))} title="Cenová data" description="100 → 103 → 101 → 106. Ceny jsou úrovně při čtyřech po sobě jdoucích pozorováních." valueLabel="Cena" formatValue={formatPrice} yDomain={[95, 110]} />
    <div>
      <h3 className="text-card-title font-semibold">Výnosová data</h3>
      <p className="mt-2 font-semibold">{prices.length} ceny → {returns.length} výnosy · N cen → N−1 výnosů</p>
      <ol aria-label="Řada výnosů" className="mt-3 flex flex-wrap gap-x-6 gap-y-2 tabular-nums">
        {returns.map((observation, index) => <li key={index}>R{["₁", "₂", "₃"][index]}: {formatReturn(observation.returnValue)} <span className="text-small text-secondary">(≈ {decimalFormat.format(observation.returnValue)})</span></li>)}
      </ol>
      <p className="mt-2 text-small text-secondary">Každý výnos vzniká z jedné sousední dvojice dostupných cen. Výpočty používají nezaokrouhlené desetinné výnosy; zaokrouhlení patří jen do zobrazení.</p>
    </div>
    <div className="hidden rounded-control border border-border md:block">
      <table className="w-full text-left text-small">
        <caption className="sr-only">Pozorované ceny a výnosy z předchozí ceny</caption>
        <thead className="bg-surface-muted"><tr>{["Pozorování", "Cena", "Změna", "Výnos", "Období"].map((label) => <th key={label} scope="col" className="p-3 font-semibold">{label}</th>)}</tr></thead>
        <tbody>{prices.map((point, index) => {
          const periodIndex = index - 1;
          return <tr key={point.label} className={`border-t border-border ${periodIndex === activePeriod ? "bg-primary-soft" : ""}`}>
            <th scope="row" className="p-3 font-semibold">{point.label}<span className="block font-normal text-secondary">{formatDate(point.date)}</span></th>
            <td className="p-3 tabular-nums">{formatPrice(point.price)}</td>
            <td className="p-3 tabular-nums">{index === 0 ? "—" : formatChange(absoluteChange(prices[index - 1].price, point.price))}</td>
            <td className="p-3 tabular-nums">{index === 0 ? "Nedefinovaný" : formatReturn(returns[periodIndex].returnValue)}</td>
            <td className="p-3">{index === 0 ? "Chybí předchozí cena" : selectPeriod(periodIndex)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <ol aria-label="Ceny a sousední dvojice" className="divide-y divide-border md:hidden">
      {prices.map((point, index) => <li key={point.label} className={`py-4 ${index - 1 === activePeriod ? "bg-primary-soft" : ""}`}>
        <p className="font-semibold">{point.label} · {formatDate(point.date)} · Cena {formatPrice(point.price)}</p>
        {index === 0 ? <p className="mt-2 text-small">Výnos: nedefinovaný — chybí předchozí cena.</p> : <>
          <p className="mt-2 text-small">Dvojice {prices[index - 1].label} → {point.label}: {formatPrice(prices[index - 1].price)} → {formatPrice(point.price)}</p>
          <p className="mt-2 tabular-nums">Změna {formatChange(absoluteChange(prices[index - 1].price, point.price))} · Výnos {formatReturn(returns[index - 1].returnValue)}</p>
          <div className="mt-2">{selectPeriod(index - 1)}</div>
        </>}
      </li>)}
    </ol>
    <div aria-live="polite"><ConceptCard title={`${previous.label} → ${current.label}`}>
      <p>{formatPrice(observation.startClose)} → {formatPrice(observation.endClose)}</p>
      <p className="mt-2 text-small text-secondary">{formatDate(observation.startDate)} → {formatDate(observation.endDate)} · {observation.elapsedCalendarDays === 1 ? "1 kalendářní den" : `${observation.elapsedCalendarDays} kalendářní dny`}</p>
      {observation.gapClassification === "unknown" ? <p className="mt-2 text-small">Jde o sousední dostupná pozorování s odstupem více dnů. Bez burzovního kalendáře nevíme, zda některá obchodní pozorování chybí. Ceny mezi nimi nedoplňujeme.</p> : null}
      <p className="mt-3">Předchozí cena {formatPrice(previous.price)} je jmenovatel. Změna je {formatChange(currentChange)} a výnos je {formatReturn(currentReturn)}.</p>
    </ConceptCard></div>
    <div className="border-t border-border pt-4">
      <h3 className="font-semibold">Nulový výnos není chybějící výnos</h3>
      <p className="mt-2">Samostatný příklad: 100 → 100 znamená {formatReturn(simpleReturn(100, 100))}. Máme dvě pozorované ceny a jsou stejné.</p>
      <p className="mt-2">U první ceny P₀ předchozí pozorování chybí, proto výnos není definovaný. Nulu sem nedoplňujeme.</p>
    </div>
  </section>;
}
