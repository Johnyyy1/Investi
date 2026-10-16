"use client";

import { FinanceInput } from "@/components/learning/finance-input";
import { MetricResult } from "@/components/learning/metric-result";
import { useMemo, useState } from "react";
import { FinancialInputError, absoluteChange, parsePrice, simpleReturn } from "@/features/finance/returns";

function formatChange(value: number) {
  return `${value >= 0 ? "+" : ""}${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 6 }).format(value)}`;
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value * 100)} %`;
}

export function ReturnCalculator() {
  const [start, setStart] = useState("100");
  const [end, setEnd] = useState("115");
  const result = useMemo(() => {
    try {
      const startingPrice = parsePrice(start, "Počáteční cena");
      const endingPrice = parsePrice(end, "Konečná cena");
      return { change: absoluteChange(startingPrice, endingPrice), returnValue: simpleReturn(startingPrice, endingPrice) };
    } catch (error) {
      return { error: error instanceof FinancialInputError ? error.message : "Zadej platné ceny." };
    }
  }, [start, end]);

  return <section aria-labelledby="return-calculator-heading" className="space-y-6">
    <h3 id="return-calculator-heading" className="text-card-title font-semibold">Kalkulačka výnosu</h3>
    <div className="grid gap-5 sm:grid-cols-2"><FinanceInput label="Počáteční cena" value={start} onValueChange={setStart} aria-describedby={"error" in result ? "calculator-error" : undefined} aria-invalid={"error" in result} /><FinanceInput label="Konečná cena" value={end} onValueChange={setEnd} aria-describedby={"error" in result ? "calculator-error" : undefined} aria-invalid={"error" in result} /></div>
    {"error" in result ? <p id="calculator-error" role="alert" className="text-small text-danger-ink">{result.error}</p> : <div aria-live="polite" className="grid gap-6 border-y border-border py-6 sm:grid-cols-2"><MetricResult label="Absolutní změna" value={formatChange(result.change)} /><MetricResult label="Procentní výnos" value={formatPercent(result.returnValue)} /></div>}
  </section>;
}
