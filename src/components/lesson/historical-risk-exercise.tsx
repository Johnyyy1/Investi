"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { FinanceInput } from "@/components/learning/finance-input";
import { LearningChart } from "@/components/learning/learning-chart";
import { MetricResult } from "@/components/learning/metric-result";
import { Button, ButtonLink } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { recoveryReturn } from "@/features/finance/returns";
import type { RiskHistoryEntry, RiskHistorySnapshot } from "@/features/lessons/real-history/risk-window";
import { checkPercentAnswer, unavailableMessage } from "@/features/lessons/real-history/snapshot";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { SourceLabel } from "./historical-returns-exercise";

type Mode = "volatility" | "max-drawdown";
type Attempt = { input: string; verdict?: boolean; revealed: boolean };

const assetLabels = { equity: "akcie", etf: "fond ETF", index: "index" };
const percentFormat = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = (value: number) => `${value < 0 ? "−" : ""}${percentFormat.format(Math.abs(value) * 100)} %`;
const formatDay = (date: string) => formatDate(`${date}T00:00:00.000Z`, { timeZone: "UTC" });
/** The shown daily deviation is rounded to two decimals (×√252 ≈ ±0,08 p. b.) and the answer to one (±0,05 p. b.). */
const TOLERANCE = { volatility: 0.15, "max-drawdown": 0.05 } as const;

const copy = {
  volatility: {
    question: "Který z nich v roce 2022 kolísal víc?",
    winner: (snapshots: RiskHistorySnapshot[]) => snapshots.reduce((best, item) => item.metrics.annualisedVolatility > best.metrics.annualisedVolatility ? item : best),
    expected: (snapshot: RiskHistorySnapshot) => snapshot.metrics.annualisedVolatility,
    result: (snapshot: RiskHistorySnapshot) => `${snapshot.symbol}: ${percent(snapshot.metrics.annualisedVolatility)} ročně`,
  },
  "max-drawdown": {
    question: "Který z nich v roce 2022 propadl hlouběji?",
    winner: (snapshots: RiskHistorySnapshot[]) => snapshots.reduce((worst, item) => item.metrics.maxDrawdown.depth < worst.metrics.maxDrawdown.depth ? item : worst),
    expected: (snapshot: RiskHistorySnapshot) => snapshot.metrics.maxDrawdown.depth,
    result: (snapshot: RiskHistorySnapshot) => `${snapshot.symbol}: ${percent(snapshot.metrics.maxDrawdown.depth)}`,
  },
} as const;

/** Ungraded practice on a frozen year of daily closes: it never feeds lesson completion or rewards. */
export function HistoricalRiskExercise({ mode, history }: { mode: Mode; history?: readonly RiskHistoryEntry[] }) {
  const entries = history ?? [];
  const snapshots = entries.flatMap((entry) => entry.status === "ok" ? [entry.snapshot] : []);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [selected, setSelected] = useState(() => Math.max(0, entries.findIndex((entry) => entry.status === "ok")));
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  if (!snapshots.length) return <Feedback state="warning" role="status">{unavailableMessage} Lekci můžeš normálně dokončit.</Feedback>;
  const comparable = snapshots.length > 1;
  const winner = comparable ? copy[mode].winner(snapshots) : null;
  const entry = entries[selected];
  const instrument = entry.status === "ok" ? entry.snapshot : entry.instrument;

  return <section aria-label="Cvičení na historických cenách" className="min-w-0 space-y-6">
    {comparable ? <fieldset className="space-y-3">
      <legend className="text-body font-semibold">Předpověď: {copy[mode].question}</legend>
      {/* Once locked, the guess lives in the feedback; the instrument switch below takes over the buttons. */}
      {prediction ? null : <div className="flex flex-wrap gap-2">
        {snapshots.map((snapshot) => <Button key={snapshot.instrumentId} variant="secondary" size="compact" onClick={() => setPrediction(snapshot.instrumentId)}>{snapshot.symbol} · {assetLabels[snapshot.assetType]}</Button>)}
      </div>}
      <div aria-live="polite">{prediction && winner ? <Feedback state={prediction === winner.instrumentId ? "correct" : "incorrect"} role="status">
        <p className="font-semibold">Tvůj odhad: {snapshots.find((snapshot) => snapshot.instrumentId === prediction)?.symbol}. {prediction === winner.instrumentId ? "Odhad sedí." : "Tentokrát ne."} {mode === "volatility" ? "Víc kolísal" : "Hlouběji propadl"} {winner.symbol}.</p>
        <p className="mt-1 text-small">{snapshots.map(copy[mode].result).join(" · ")}. {mode === "volatility" ? "Jednotlivá firma obvykle kolísá víc než široký koš stovek firem." : "Široký koš firem ztráty jednotlivých firem částečně vyrovná."} Teď si číslo jednoho z nich spočítej.</p>
      </Feedback> : <p className="text-small text-secondary">Vyber svůj odhad. Pak se odhalí čísla.</p>}</div>
    </fieldset> : null}

    {!comparable || prediction ? <>
      <div role="group" aria-label="Instrument" className="flex flex-wrap gap-2">
        {entries.map((item, index) => {
          const { instrumentId, symbol, assetType } = item.status === "ok" ? item.snapshot : item.instrument;
          return <Button key={instrumentId} variant={index === selected ? "primary" : "secondary"} size="compact" aria-pressed={index === selected} onClick={() => setSelected(index)}>{symbol} · {assetLabels[assetType]}</Button>;
        })}
      </div>
      <div>
        <h4 className="text-card-title font-semibold">{instrument.name} ({instrument.symbol})</h4>
        {entry.status === "ok" ? <SourceLabel snapshot={entry.snapshot} /> : null}
      </div>
      {entry.status === "ok"
        ? <Exercise key={entry.snapshot.instrumentId} mode={mode} snapshot={entry.snapshot} attempt={attempts[entry.snapshot.instrumentId] ?? { input: "", revealed: false }} onAttempt={(attempt) => setAttempts((current) => ({ ...current, [entry.snapshot.instrumentId]: attempt }))} />
        : <Feedback state="warning" role="status">{entry.message}</Feedback>}
    </> : null}
  </section>;
}

function Exercise({ mode, snapshot, attempt, onAttempt }: { mode: Mode; snapshot: RiskHistorySnapshot; attempt: Attempt; onAttempt: (attempt: Attempt) => void }) {
  const { points, currency, metrics } = snapshot;
  const { maxDrawdown } = metrics;
  const price = (value: number) => formatCurrency(value, currency, { minimumFractionDigits: 2 });
  const expected = copy[mode].expected(snapshot);
  const tolerance = TOLERANCE[mode];
  const verdictOf = (input: string) => checkPercentAnswer(input, expected, tolerance);
  const invalid = attempt.verdict === undefined && attempt.input.trim() !== "" && verdictOf(attempt.input) === undefined;
  const dailyDeviation = percentFormat.format(metrics.dailyDeviation * 100);

  function check(event: FormEvent) {
    event.preventDefault();
    const verdict = verdictOf(attempt.input);
    if (verdict !== undefined) onAttempt({ ...attempt, verdict, revealed: attempt.revealed || verdict });
  }

  return <>
    <LearningChart dots={false} data={points.map((point) => ({ label: formatDay(point.date), value: point.close }))} title="Denní zavírací ceny" description={`${snapshot.period} ${points.length} pozorování od ${formatDay(points[0].date)} do ${formatDay(points[points.length - 1].date)}.`} valueLabel="Cena" formatValue={price} />
    {mode === "volatility"
      ? <dl className="grid gap-5 border-y border-border py-5 sm:grid-cols-2">
        <div><dt className="text-small text-secondary">Denní směrodatná odchylka</dt><dd className="mt-1 text-section-title font-semibold tabular-nums">{dailyDeviation} %</dd><dd className="mt-1 text-microcopy text-secondary">Výběrová (n − 1) z {metrics.returnCount} denních jednoduchých výnosů.</dd></div>
        <div><dt className="text-small text-secondary">Obchodních dní v roce</dt><dd className="mt-1 text-section-title font-semibold tabular-nums">252</dd><dd className="mt-1 text-microcopy text-secondary">Konvence Labu pro denní data.</dd></div>
      </dl>
      : <dl className="grid gap-5 border-y border-border py-5 sm:grid-cols-2">
        <div><dt className="text-small text-secondary">Vrchol před propadem</dt><dd className="mt-1 text-section-title font-semibold tabular-nums">{price(maxDrawdown.peakClose)}</dd><dd className="mt-1 text-microcopy text-secondary">{formatDay(maxDrawdown.peakDate)}</dd></div>
        <div><dt className="text-small text-secondary">Dno propadu</dt><dd className="mt-1 text-section-title font-semibold tabular-nums">{price(maxDrawdown.troughClose)}</dd><dd className="mt-1 text-microcopy text-secondary">{formatDay(maxDrawdown.troughDate)}</dd></div>
      </dl>}
    <form onSubmit={check} className="flex flex-col gap-3">
      <p className="text-body">{mode === "volatility"
        ? `Převeď denní směrodatnou odchylku ${dailyDeviation} % na rok: vynásob ji √252.`
        : `Spočítej největší propad: dno ${price(maxDrawdown.troughClose)} vyděl vrcholem ${price(maxDrawdown.peakClose)} a odečti 1.`}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <FinanceInput className="sm:max-w-md sm:flex-1" label={mode === "volatility" ? "Anualizovaná volatilita" : "Největší propad"} mode="percentage" value={attempt.input} onValueChange={(input) => onAttempt({ ...attempt, input, verdict: undefined })} error={invalid ? "Zadej číslo, například 24,5." : undefined} hint={mode === "volatility" ? "Na jedno desetinné místo stačí." : "Propad je záporné číslo. Na dvě desetinná místa stačí."} />
        <Button type="submit" variant="secondary" size="compact" disabled={verdictOf(attempt.input) === undefined}>Zkontrolovat výpočet</Button>
      </div>
    </form>
    <div aria-live="polite" className="space-y-3">
      {attempt.verdict === true ? <Feedback state="correct" role="status"><p className="font-semibold">Správně.</p><p className="mt-1 text-small">{mode === "volatility"
        ? `${dailyDeviation} % × √252 ≈ ${percent(expected)}.`
        : `${price(maxDrawdown.troughClose)} ÷ ${price(maxDrawdown.peakClose)} − 1 ≈ ${percent(expected)}.`}</p></Feedback> : null}
      {attempt.verdict === false ? <Feedback state="incorrect" role="status"><p className="font-semibold">Zatím to nesedí.</p><p className="mt-1 text-small">{mode === "volatility"
        ? `√252 ≈ 15,87. Vynásob jím ${dailyDeviation} %, ne číslem 252.`
        : "Dno vyděl vrcholem, odečti 1 a výsledek vynásob 100. Propad je záporný."}</p>
        {attempt.revealed ? null : <Button variant="ghost" size="compact" className="mt-2 -ml-4" onClick={() => onAttempt({ ...attempt, revealed: true })}>Ukázat řešení</Button>}</Feedback> : null}
      {attempt.revealed && attempt.verdict !== true ? <p className="text-small">Řešení: {percent(expected)}.</p> : null}
    </div>
    {attempt.revealed ? (mode === "volatility"
      ? <div className="grid gap-6 border-y border-border py-6 sm:grid-cols-2">
        <MetricResult label="Anualizovaná volatilita" value={percent(metrics.annualisedVolatility)} note="Spočítáno stejnou funkcí, kterou používá Lab na detailu instrumentu." />
        <MetricResult label="Největší propad ve stejném roce" value={percent(maxDrawdown.depth)} sentiment="negative" note="Volatilita i propad popisují minulost, ne budoucnost." />
      </div>
      : <div className="grid gap-6 border-y border-border py-6 sm:grid-cols-2">
        <MetricResult label="Návrat na vrchol" value={maxDrawdown.recoveryDate ? formatDay(maxDrawdown.recoveryDate) : "Do konce roku nenastal"} note={maxDrawdown.recoveryDate ? undefined : "V tomto okně cena vrchol znovu nepřekonala."} />
        <MetricResult label="Zisk potřebný k návratu" value={`+${percentFormat.format(recoveryReturn(-maxDrawdown.depth) * 100)} %`} sentiment="positive" note={`${price(maxDrawdown.peakClose)} ÷ ${price(maxDrawdown.troughClose)} − 1`} />
      </div>) : null}
    {snapshot.labHref ? <ButtonLink href={snapshot.labHref} variant="ghost" size="compact" className="-ml-4 w-fit">Podívej se na tenhle instrument v Labu<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink> : null}
  </>;
}
