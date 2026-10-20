"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { MetricResult } from "@/components/learning/metric-result";
import { Button, ButtonLink } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { simpleReturn } from "@/features/finance/returns";
import { correlationReading, correlationView, formatCoefficient } from "@/features/instruments/comparison-presentation";
import { commonCloses, returnCorrelation, type ReturnCorrelation } from "@/features/instruments/correlation";
import { dayNumber, MAX_VOLATILITY_GAP_DAYS } from "@/features/instruments/price-metrics";
import { instrumentCompareHref } from "@/features/instruments/routes";
import type { RiskHistoryEntry, RiskHistorySnapshot } from "@/features/lessons/real-history/risk-window";
import { isRealHistory, unavailableMessage } from "@/features/lessons/real-history/snapshot";
import { SourceLabel } from "./historical-returns-exercise";
import { ReturnScatter } from "./return-scatter";

type Band = "weak" | "moderate" | "strong";
const bands = [
  { id: "weak", label: "Slabě nebo vůbec", detail: "pod 0,3" },
  { id: "moderate", label: "Středně", detail: "0,3 až 0,7" },
  { id: "strong", label: "Silně", detail: "0,7 a víc" },
] as const satisfies readonly { id: Band; label: string; detail: string }[];
/** The comparison's reading bands of |r|, so the lesson and the Lab name the same strength. */
const bandOf = (coefficient: number): Band => Math.abs(coefficient) < 0.3 ? "weak" : Math.abs(coefficient) < 0.7 ? "moderate" : "strong";
const assetLabels = { equity: "akcie", etf: "fond ETF", index: "index" };
const firstHalf = (snapshot: RiskHistorySnapshot) => snapshot.points.filter((point) => point.date < "2022-07-01");
const secondHalf = (snapshot: RiskHistorySnapshot) => snapshot.points.filter((point) => point.date >= "2022-07-01");
const halfValue = (correlation: ReturnCorrelation) => correlation.status === "ok" ? formatCoefficient(correlation.coefficient) : "Nedostupné";

/** Daily paired returns in percent, on common dates and without bridging gaps, as returnCorrelation pairs them. */
function dailyPairs(first: RiskHistorySnapshot, second: RiskHistorySnapshot) {
  const closes = commonCloses(first.points, second.points);
  return closes.slice(1).flatMap((close, index) => {
    const previous = closes[index];
    if (dayNumber(close.date) - dayNumber(previous.date) > MAX_VOLATILITY_GAP_DAYS) return [];
    return [{ x: simpleReturn(previous.first, close.first) * 100, y: simpleReturn(previous.second, close.second) * 100 }];
  });
}

/** Ungraded practice on a frozen year of two instruments: it never feeds lesson completion or rewards. */
export function HistoricalCorrelationExercise({ history }: { history?: readonly RiskHistoryEntry[] }) {
  const [prediction, setPrediction] = useState<Band | null>(null);
  const snapshots = (history ?? []).flatMap((entry) => entry.status === "ok" ? [entry.snapshot] : []);
  if (snapshots.length < 2) return <Feedback state="warning" role="status">{unavailableMessage} Korelace potřebuje oba instrumenty. Lekci můžeš normálně dokončit.</Feedback>;
  const [first, second] = snapshots;
  const correlation = returnCorrelation(first.points, second.points);
  if (correlation.status !== "ok") return <Feedback state="warning" role="status">Korelaci pro tento rok nelze spočítat. Nic nedoplňujeme nulou ani ukázkovými čísly. Lekci můžeš normálně dokončit.</Feedback>;
  const view = correlationView(correlation, null);
  const reading = correlationReading(correlation.coefficient);
  const sample = !isRealHistory(first) || !isRealHistory(second);
  const pair = `${first.symbol} a ${second.symbol}`;

  return <section aria-label="Cvičení na historických cenách" className="min-w-0 space-y-6">
    <ul className="grid gap-3 sm:grid-cols-2">
      {[first, second].map((snapshot, index) => <li key={snapshot.instrumentId} className="min-w-0">
        <p className="text-card-title font-semibold">{index === 0 ? "A" : "B"} · {snapshot.name} ({snapshot.symbol}) · {assetLabels[snapshot.assetType]}</p>
        <SourceLabel snapshot={snapshot} />
      </li>)}
    </ul>
    <fieldset className="space-y-3">
      <legend className="text-body font-semibold">Předpověď: Jak silně spolu v roce 2022 korelovaly denní výnosy {pair}?</legend>
      {prediction ? null : <div className="flex flex-wrap gap-2">
        {bands.map((band) => <Button key={band.id} variant="secondary" size="compact" onClick={() => setPrediction(band.id)}>{band.label} · {band.detail}</Button>)}
      </div>}
      <div aria-live="polite">{prediction ? <Feedback state={prediction === bandOf(correlation.coefficient) ? "correct" : "incorrect"} role="status">
        <p className="font-semibold">Tvůj odhad: {bands.find((band) => band.id === prediction)!.label.toLocaleLowerCase("cs-CZ")}. {prediction === bandOf(correlation.coefficient) ? "Odhad sedí." : "Tentokrát ne."} {reading.label}: {view.status === "ok" ? view.value : ""}.</p>
        <p className="mt-1 text-small">{reading.meaning}{sample ? " Ukázková řada je vymyšlená, proto se může chovat jinak než skutečný trh." : ""}</p>
      </Feedback> : <p className="text-small text-secondary">Vyber svůj odhad. Pak se odhalí body i číslo.</p>}</div>
    </fieldset>

    {prediction ? <>
      <ReturnScatter dense points={dailyPairs(first, second)} xLabel={`denní výnos ${first.symbol}`} yLabel={`denní výnos ${second.symbol}`} description={`Každý bod je jeden obchodní den roku 2022, kdy se obchodovaly oba instrumenty. ${sample ? "Ukázková data." : "Historická data."}`} />
      <div className="space-y-5 border-y border-border py-6">
        <MetricResult label={`Korelace ${first.symbol} ↔ ${second.symbol}`} value={view.status === "ok" ? view.value : "Nedostupné"} note={view.basis ?? undefined} />
        <div className="grid gap-5 sm:grid-cols-2">
          <MetricResult label="Leden až červen" value={halfValue(returnCorrelation(firstHalf(first), firstHalf(second)))} />
          <MetricResult label="Červenec až prosinec" value={halfValue(returnCorrelation(secondHalf(first), secondHalf(second)))} />
        </div>
        <p className="text-small text-secondary">Spočítáno stejnou funkcí, kterou používá porovnání v Labu: Pearsonova korelace denních cenových výnosů ve dnech, kdy se obchodovaly oba. Pololetí ukazují, že se korelace mění i během jednoho roku.</p>
      </div>
      <ButtonLink href={instrumentCompareHref(first.instrumentId, second.instrumentId)} variant="ghost" size="compact" className="-ml-4 w-fit">Porovnej tuhle dvojici v Labu<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>
      <p className="text-microcopy text-secondary">Lab nabízí období jako 1 rok nebo 5 let do dneška, proto tam korelace vyjde jinak než za rok 2022.</p>
    </> : null}
  </section>;
}
