"use client";

import { useMemo, useRef, useState } from "react";
import { FinanceInput } from "@/components/learning/finance-input";
import { MetricResult } from "@/components/learning/metric-result";
import { LearningChart } from "@/components/learning/learning-chart";
import { Button } from "@/components/ui/button";
import { ConceptCard } from "@/components/learning/concept-card";
import { FinancialInputError, compoundPeriods, compoundValue, cumulativeReturn, parsePrice } from "@/features/finance/returns";
import { formatDecimal, formatPercentage } from "@/lib/formatters";

function formatValue(value: number) { return formatDecimal(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatPercent(value: number) { return `${value > 0 ? "+" : ""}${formatPercentage(value)}`; }
function parsePercent(value: string, period: number) {
  if (value.trim() === "") throw new FinancialInputError(`Výnos za období ${period} je povinný.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new FinancialInputError(`Výnos za období ${period} musí být číslo.`);
  if (parsed < -100) throw new FinancialInputError(`Výnos za období ${period} nemůže být nižší než −100 %.`);
  return parsed / 100;
}

export function CompoundingExplorer() {
  const [startValue, setStartValue] = useState("100");
  const [returnInputs, setReturnInputs] = useState(["20", "-20"]);
  const addRef = useRef<HTMLButtonElement>(null);
  const result = useMemo(() => {
    try {
      const start = parsePrice(startValue, "Počáteční hodnota");
      const returns = returnInputs.map((value, index) => parsePercent(value, index + 1));
      const periods = compoundPeriods(start, returns);
      return { start, returns, periods, endingValue: compoundValue(start, returns), cumulative: cumulativeReturn(returns), arithmetic: returns.reduce((sum, value) => sum + value, 0) };
    } catch (error) { return { error: error instanceof FinancialInputError ? error.message : "Zadej platné hodnoty." }; }
  }, [returnInputs, startValue]);
  function updateReturn(index: number, value: string) { setReturnInputs((current) => current.map((item, itemIndex) => itemIndex === index ? value : item)); }
  return <section aria-labelledby="compounding-explorer-heading" className="space-y-6">
    <div><h3 id="compounding-explorer-heading" className="text-card-title font-semibold">Složené zhodnocení</h3><p className="mt-2 text-small text-secondary">Uprav dva až pět výnosů. Každé období začíná hodnotou, kterou zanechalo to předchozí.</p></div>
    <FinanceInput label="Počáteční hodnota" mode="currency" value={startValue} onValueChange={setStartValue} hint="Použij libovolnou, ale stále stejnou měnu." aria-describedby={"error" in result ? "compounding-error" : undefined} />
    <div className="grid gap-5 sm:grid-cols-2">{returnInputs.map((value, index) => <div key={index}>
      <FinanceInput label={`Výnos za období ${index + 1}`} mode="percentage" value={value} onValueChange={(value) => updateReturn(index, value)} aria-describedby={"error" in result ? "compounding-error" : undefined} />
      {returnInputs.length > 2 ? <Button variant="ghost" className="mt-2" aria-label={`Odebrat období ${index + 1}`} onClick={() => { setReturnInputs((current) => current.filter((_, itemIndex) => itemIndex !== index)); addRef.current?.focus(); }}>Odebrat</Button> : null}
    </div>)}</div>
    <Button ref={addRef} variant="secondary" disabled={returnInputs.length >= 5} onClick={() => setReturnInputs((current) => [...current, "0"])}>Přidat období</Button>
    {"error" in result ? <p id="compounding-error" role="alert" className="text-small text-danger-ink">{result.error}</p> : <>
      <div aria-live="polite" aria-atomic="true" className="grid gap-6 border-y border-border py-6 sm:grid-cols-2">
        <MetricResult label="Počáteční hodnota" value={formatValue(result.start)} />
        <MetricResult label="Konečná hodnota" value={formatValue(result.endingValue)} />
        <MetricResult label="Aritmetický součet" value={formatPercent(result.arithmetic)} note="Sčítá výnosy období, ne celkový výsledek." />
        <MetricResult label="Celkový výnos" value={formatPercent(result.cumulative)} sentiment={result.cumulative >= 0 ? "positive" : "negative"} note="Násobí růstové faktory a zachycuje skutečný celkový výnos." />
      </div>
      <LearningChart title="Hodnota v jednotlivých obdobích" description="Konečná hodnota jednoho období je začátkem dalšího." valueLabel="Hodnota investice" data={[{ label: "Začátek", value: result.start }, ...result.periods.map((period) => ({ label: `Období ${period.period}`, value: period.endValue }))]} formatValue={(value) => formatDecimal(value, { maximumFractionDigits: 2 })} />
      <details className="text-small"><summary className="cursor-pointer py-3 text-primary">Projít výpočet</summary><ol className="space-y-4">{result.periods.map((period) => <li key={period.period} className="border-t border-border pt-4"><p className="font-semibold">Období {period.period} · {formatPercent(period.returnValue)}</p><p className="mt-2 break-words text-secondary">Počáteční hodnota {formatValue(period.startValue)} → konečná hodnota {formatValue(period.endValue)}</p><p className="mt-1 text-secondary">Zisk nebo ztráta: {formatValue(period.change)}</p></li>)}</ol></details>
      <ConceptCard title="Sčítání a skládání odpovídají na jiné otázky">Aritmetický součet ignoruje měnící se základ. Po +20 % a −20 % je součet 0 %, ale ze 100 se stane 96: celkový výnos −4 %.</ConceptCard>
    </>}
  </section>;
}
