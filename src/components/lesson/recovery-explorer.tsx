"use client";

import { useMemo, useState } from "react";
import { FinanceInput } from "@/components/learning/finance-input";
import { MetricResult } from "@/components/learning/metric-result";
import { Button } from "@/components/ui/button";
import { FinancialInputError, recoveryReturn } from "@/features/finance/returns";

function formatPercent(value: number) { return new Intl.NumberFormat("cs-CZ", { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value); }

export function RecoveryExplorer() {
  const [lossInput, setLossInput] = useState("20");
  const result = useMemo(() => {
    try {
      if (!lossInput.trim()) throw new FinancialInputError("Zadej velikost ztráty.");
      const loss = Number(lossInput);
      if (!Number.isFinite(loss) || loss < 0 || loss >= 100) throw new FinancialInputError("Zadej ztrátu od 0 % do 100 % (bez 100 %).");
      return { loss: loss / 100, recovery: recoveryReturn(loss / 100) };
    } catch (error) { return { error: error instanceof FinancialInputError ? error.message : "Zadej platnou ztrátu." }; }
  }, [lossInput]);
  return <section aria-labelledby="recovery-explorer-heading" className="space-y-6">
    <div><h3 id="recovery-explorer-heading" className="text-card-title font-semibold">Průzkumník návratu po ztrátě</h3><p className="mt-3 text-body text-secondary">Ztráta sníží hodnotu, ze které se počítá další růst. Zadej velikost ztráty a zjisti, jaký zisk je potřeba k návratu.</p></div>
    <FinanceInput label="Velikost ztráty" mode="percentage" value={lossInput} onValueChange={setLossInput} error={"error" in result ? result.error : undefined} />
    <div className="flex flex-wrap gap-3" aria-label="Příklady ztrát">{[10, 20, 50].map((loss) => <Button key={loss} variant="secondary" onClick={() => setLossInput(String(loss))}>Zkusit −{loss}%</Button>)}</div>
    {"error" in result ? null : <div className="grid gap-6 border-y border-border py-6 sm:grid-cols-2" aria-live="polite" aria-atomic="true"><MetricResult label="Ztráta" value={`−${formatPercent(result.loss)}`} sentiment="negative" /><MetricResult label="Potřebný zisk pro návrat" value={`+${formatPercent(result.recovery)}`} sentiment="positive" note="Počítá se z nižší zbývající hodnoty." /></div>}
  </section>;
}
