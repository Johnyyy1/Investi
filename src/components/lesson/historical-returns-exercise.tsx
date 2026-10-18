"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { FinanceInput } from "@/components/learning/finance-input";
import { LearningChart } from "@/components/learning/learning-chart";
import { MetricResult } from "@/components/learning/metric-result";
import { Button, ButtonLink } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { checkPercentAnswer, isRealHistory, snapshotReturns, unavailableMessage, type LessonHistoryEntry, type LessonHistorySnapshot } from "@/features/lessons/real-history/snapshot";
import { formatCurrency, formatDate } from "@/lib/formatters";

const sourceNames: Record<string, string> = { "financial-modeling-prep": "Financial Modeling Prep" };
const assetLabels = { equity: "akcie", etf: "fond ETF" };
const subscript = (value: number) => String(value).replace(/\d/g, (digit) => "₀₁₂₃₄₅₆₇₈₉"[Number(digit)]);
const returnFormat = new Intl.NumberFormat("cs-CZ", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
const formatReturn = (value: number) => returnFormat.format(value);
const formatDay = (date: string) => formatDate(`${date}T00:00:00.000Z`, { timeZone: "UTC" });

type Attempt = { input: string; verdict?: boolean; revealed: boolean };

/** Ungraded practice on frozen history: it never feeds lesson completion or rewards. */
export function HistoricalReturnsExercise({ mode, history }: { mode: "period" | "cumulative"; history?: readonly LessonHistoryEntry[] }) {
  const entries = history ?? [];
  const [selected, setSelected] = useState(() => Math.max(0, entries.findIndex((entry) => entry.status === "ok")));
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  if (!entries.some((entry) => entry.status === "ok")) return <Feedback state="warning" role="status">{unavailableMessage} Lekci můžeš normálně dokončit.</Feedback>;
  const entry = entries[selected];
  const instrument = entry.status === "ok" ? entry.snapshot : entry.instrument;

  return <section aria-label="Cvičení na historických cenách" className="min-w-0 space-y-6">
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
  </section>;
}

function SourceLabel({ snapshot }: { snapshot: LessonHistorySnapshot }) {
  const { provenance, points, currency } = snapshot;
  const asOf = formatDay(points[points.length - 1].date);
  return isRealHistory(snapshot)
    ? <div className="mt-1 text-small text-secondary">
      <p className="font-semibold text-foreground">Historická data · {sourceNames[provenance.provider] ?? provenance.provider} · stav k {asOf}</p>
      <p>Ceny očištěné o splity · jen cena, bez dividend · {currency} · načteno {formatDate(provenance.retrievedAt, { timeZone: "UTC" })}{provenance.completeness === "partial" ? " · zdroj hlásí neúplnou řadu" : ""}</p>
    </div>
    : <div className="mt-1 text-small text-secondary">
      <p className="font-semibold text-foreground">Ukázková data · pevná data pro výuku, ne skutečný vývoj trhu</p>
      <p>Jen cena, bez dividend · {currency}</p>
    </div>;
}

function Exercise({ mode, snapshot, attempt, onAttempt }: { mode: "period" | "cumulative"; snapshot: LessonHistorySnapshot; attempt: Attempt; onAttempt: (attempt: Attempt) => void }) {
  const { points, currency } = snapshot;
  const { periods, compounded, direct, arithmeticSum } = snapshotReturns(points);
  const last = points.length - 1;
  const expected = mode === "period" ? periods[0].returnValue : compounded;
  const showReturns = mode === "cumulative" || attempt.revealed;
  const price = (value: number) => formatCurrency(value, currency, { minimumFractionDigits: 2 });
  const label = (index: number) => `P${subscript(index)}`;
  const taskLabel = mode === "period" ? `Výnos za 1. období (${formatDay(points[0].date)} → ${formatDay(points[1].date)})` : `Kumulativní výnos (${formatDay(points[0].date)} → ${formatDay(points[last].date)})`;
  const growthFactors = periods.map((_, index) => `(1 + R${subscript(index + 1)})`).join(" × ");
  const invalid = attempt.verdict === undefined && attempt.input.trim() !== "" && checkPercentAnswer(attempt.input, expected) === undefined;

  function check(event: FormEvent) {
    event.preventDefault();
    const verdict = checkPercentAnswer(attempt.input, expected);
    if (verdict !== undefined) onAttempt({ ...attempt, verdict, revealed: attempt.revealed || verdict });
  }

  return <>
    <LearningChart data={points.map((point, index) => ({ label: label(index), value: point.close }))} title="Závěrečné ceny" description={`${points.map((point) => price(point.close)).join(" → ")}. ${snapshot.sampling}`} valueLabel="Cena" formatValue={price} />
    <div className="hidden rounded-control border border-border md:block">
      <table className="w-full text-left text-small">
        <caption className="sr-only">Závěrečné ceny {snapshot.symbol} a výnosy z předchozí ceny</caption>
        <thead className="bg-surface-muted"><tr>{["Pozorování", "Závěrečná cena", "Výnos za období"].map((heading) => <th key={heading} scope="col" className="p-3 font-semibold">{heading}</th>)}</tr></thead>
        <tbody>{points.map((point, index) => <tr key={point.date} className="border-t border-border">
          <th scope="row" className="p-3 font-semibold">{label(index)}<span className="block font-normal text-secondary">{formatDay(point.date)}</span></th>
          <td className="p-3 tabular-nums">{price(point.close)}</td>
          <td className="p-3 tabular-nums">{index === 0 ? "Nedefinovaný" : showReturns ? `R${subscript(index)}: ${formatReturn(periods[index - 1].returnValue)}` : "Odhalí se po kontrole"}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <ol aria-label={`Závěrečné ceny ${snapshot.symbol}`} className="divide-y divide-border md:hidden">
      {points.map((point, index) => <li key={point.date} className="py-3">
        <p className="font-semibold">{label(index)} · {formatDay(point.date)} · {price(point.close)}</p>
        <p className="mt-1 text-small tabular-nums text-secondary">{index === 0 ? "Výnos: nedefinovaný — chybí předchozí cena." : showReturns ? `R${subscript(index)}: ${formatReturn(periods[index - 1].returnValue)}` : "Výnos se odhalí po kontrole."}</p>
      </li>)}
    </ol>
    <form onSubmit={check} className="flex flex-col gap-3 border-t border-border pt-5">
      <p className="text-body">{mode === "period"
        ? `Vypočítej výnos za první období: cena se změnila z ${price(points[0].close)} na ${price(points[1].close)}.`
        : `Výnosy všech ${periods.length} období znáš z tabulky. Slož je: ${growthFactors} − 1.`}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <FinanceInput className="sm:max-w-md sm:flex-1" label={taskLabel} mode="percentage" value={attempt.input} onValueChange={(input) => onAttempt({ ...attempt, input, verdict: undefined })} error={invalid ? "Zadej číslo, například 4,25." : undefined} hint="Na dvě desetinná místa stačí." />
        <Button type="submit" variant="secondary" size="compact" disabled={checkPercentAnswer(attempt.input, expected) === undefined}>Zkontrolovat výpočet</Button>
      </div>
    </form>
    <div aria-live="polite" className="space-y-3">
      {attempt.verdict === true ? <Feedback state="correct" role="status"><p className="font-semibold">Správně.</p><p className="mt-1 text-small">{mode === "period"
        ? `(${price(points[1].close)} − ${price(points[0].close)}) ÷ ${price(points[0].close)} = ${formatReturn(expected)}. Jmenovatel je předchozí cena.`
        : `${growthFactors} − 1 = ${formatReturn(compounded)}.`}</p></Feedback> : null}
      {attempt.verdict === false ? <Feedback state="incorrect" role="status"><p className="font-semibold">Zatím to nesedí.</p><p className="mt-1 text-small">{mode === "period"
        ? `Změnu ceny vyděl předchozí cenou: (${price(points[1].close)} − ${price(points[0].close)}) ÷ ${price(points[0].close)} × 100.`
        : "Ke každému výnosu přičti 1 (desetinně), růstové faktory vynásob a od součinu odečti 1. Výnosy nesčítej."}</p>
        {attempt.revealed ? null : <Button variant="ghost" size="compact" className="mt-2 -ml-4" onClick={() => onAttempt({ ...attempt, revealed: true })}>Ukázat řešení</Button>}</Feedback> : null}
      {attempt.revealed && attempt.verdict !== true ? <p className="text-small">Řešení: {formatReturn(expected)}.</p> : null}
    </div>
    {mode === "cumulative" && attempt.revealed ? <div className="grid gap-6 border-y border-border py-6 sm:grid-cols-3">
      <MetricResult label="Složený výnos" value={formatReturn(compounded)} note="Součin růstových faktorů minus 1." />
      <MetricResult label="Přímý cenový výnos" value={formatReturn(direct)} note={`${label(last)} ÷ ${label(0)} − 1, stejný výsledek.`} />
      <MetricResult label="Prostý součet výnosů" value={formatReturn(arithmeticSum)} note="Přehlíží měnící se základ, proto se liší." />
    </div> : null}
    {snapshot.labHref ? <ButtonLink href={snapshot.labHref} variant="ghost" size="compact" className="-ml-4 w-fit">Podívej se na tenhle instrument v Labu<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink> : null}
  </>;
}
