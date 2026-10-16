"use client";

import { useId, useState } from "react";
import { ConceptCard } from "@/components/learning/concept-card";
import { FinanceInput } from "@/components/learning/finance-input";
import { MetricResult } from "@/components/learning/metric-result";
import { FinancialInputError, parsePrice } from "@/features/finance/returns";
import { portfolioWeightedReturn, validatePortfolioWeights } from "@/features/finance/foundations";
import { Slider } from "@/components/ui/form-controls";

import { portfolioAssets as assets } from "@/features/lab/portfolio";
type AssetId = typeof assets[number]["id"];
type Inputs = Record<AssetId, string>;

const presets: { label: string; allocation: Inputs }[] = [
  { label: "100 % akcie", allocation: { stocks: "100", bonds: "0", cash: "0" } },
  { label: "Příklad 60 / 30 / 10", allocation: { stocks: "60", bonds: "30", cash: "10" } },
];

const formatPercent = (value: number, maximumFractionDigits = 2) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString("cs-CZ", { maximumFractionDigits })} %`;

function parseAllocations(values: Inputs) {
  const errors: Partial<Record<AssetId, string>> = {};
  const percentages = assets.map(({ id, label }) => {
    try {
      const value = parsePrice(values[id], `Rozložení pro ${label.toLowerCase()}`);
      if (value < 0 || value > 100) throw new FinancialInputError(`Rozložení pro ${label.toLowerCase()} musí být od 0 % do 100 %.`);
      return value;
    } catch (cause) {
      errors[id] = cause instanceof Error ? cause.message : "Zadej platné rozložení.";
      return undefined;
    }
  });
  return { errors, percentages };
}

export function PortfolioBuilder() {
  const [allocations, setAllocations] = useState<Inputs>(presets[1].allocation);
  const [returns, setReturns] = useState<Inputs>({ stocks: "8", bonds: "2", cash: "0" });
  const allocationErrorId = useId();
  const returnErrorId = useId();
  const parsed = parseAllocations(allocations);
  const completeAllocations = parsed.percentages.every((value): value is number => value !== undefined);
  const allocationPercentages = completeAllocations ? parsed.percentages as number[] : undefined;
  const total = allocationPercentages ? allocationPercentages.reduce((sum, value) => sum + value, 0) : undefined;
  const remaining = total === undefined ? undefined : 100 - total;
  let allocationMessage = "Zadej platné procento pro každé aktivum.";
  let valid = false;
  if (completeAllocations) {
    try {
      validatePortfolioWeights(allocationPercentages!.map((value) => value / 100));
      valid = true;
      allocationMessage = "Hotovo · rozložení je přesně 100 %.";
    } catch {
      allocationMessage = remaining! > 0 ? `Rozděl ještě ${formatPercent(remaining!, 4).replace("+", "")}.` : `Sniž rozložení o ${formatPercent(Math.abs(remaining!), 4).replace("+", "")}.`;
    }
  }

  const returnErrors: Partial<Record<AssetId, string>> = {};
  const parsedReturns = assets.map(({ id, label }) => {
    try {
      const value = parsePrice(returns[id], `Výnos pro ${label.toLowerCase()}`);
      if (value < -100) throw new FinancialInputError(`Výnos pro ${label.toLowerCase()} nemůže být nižší než −100 %.`);
      return value;
    } catch (cause) {
      returnErrors[id] = cause instanceof Error ? cause.message : "Zadej platný výnos.";
      return undefined;
    }
  });
  const completeReturns = parsedReturns.every((value): value is number => value !== undefined);
  const portfolioReturn = valid && completeReturns ? portfolioWeightedReturn(allocationPercentages!.map((value) => value / 100), parsedReturns.map((value) => value / 100)) * 100 : undefined;

  function setAllocation(id: AssetId, value: string) {
    setAllocations((current) => ({ ...current, [id]: value }));
  }
  function setReturn(id: AssetId, value: string) {
    setReturns((current) => ({ ...current, [id]: value }));
  }

  return <section aria-label="Sestavení portfolia" className="min-w-0 space-y-8">
    <div>
      <h3 className="text-card-title font-semibold">Sestavení portfolia</h3>
      <p className="mt-2 text-body text-secondary">Nastav, jakou část tohoto hypotetického portfolia tvoří jednotlivé kategorie aktiv. Jde o vzdělávací sandbox, ne o doporučené rozložení.</p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Načíst příklad rozložení">
      {presets.map((preset) => {
        const selected = assets.every(({ id }) => allocations[id] === preset.allocation[id]);
        return <button key={preset.label} type="button" aria-pressed={selected} onClick={() => setAllocations(preset.allocation)} className={`min-h-12 rounded-control border px-4 py-3 text-left text-small font-semibold transition-colors ${selected ? "border-primary bg-surface-muted text-primary" : "border-border hover:bg-surface-muted"}`}>{preset.label}</button>;
      })}
    </div>

    <div className="space-y-6">
      {assets.map((asset, index) => {
        const sliderValue = parsed.percentages[index] ?? 0;
        return <div key={asset.id} className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-start">
          <div className="min-w-0">
            <label htmlFor={`${allocationErrorId}-${asset.id}-slider`} className="mb-2 flex items-center gap-2 text-small font-semibold"><span aria-hidden="true" className={`h-3 w-3 rounded-full ${asset.color}`} />{asset.label}</label>
            <Slider id={`${allocationErrorId}-${asset.id}-slider`} aria-label={`Rozložení pro ${asset.label.toLowerCase()}`} min="0" max="100" step="1" value={sliderValue} onChange={(event) => setAllocation(asset.id, event.target.value)} />
          </div>
          <FinanceInput label={`Rozložení · ${asset.label}`} mode="percentage" value={allocations[asset.id]} onValueChange={(value) => setAllocation(asset.id, value)} error={parsed.errors[asset.id]} />
        </div>;
      })}
    </div>

    {completeAllocations ? <div role="img" className="h-6 overflow-hidden rounded-pill bg-surface-muted" aria-label={`Rozložení portfolia: ${assets.map((asset, index) => `${asset.label} ${parsed.percentages[index]} %`).join(", ")}`}>
      <div className="flex h-full min-w-0">
        {assets.map((asset, index) => <span key={asset.id} title={`${asset.label}: ${parsed.percentages[index]}%`} aria-hidden="true" className={`h-full shrink-0 ${asset.color}`} style={{ width: `${parsed.percentages[index]}%` }} />)}
      </div>
    </div> : null}

    <div aria-live="polite" aria-atomic="true" className="grid gap-5 border-y border-border py-6 sm:grid-cols-2">
      <MetricResult label="Celkové rozložení" value={total === undefined ? "—" : `${total.toLocaleString("cs-CZ", { maximumFractionDigits: 4 })} %`} />
      <MetricResult label="Zbývá rozdělit" value={remaining === undefined ? "—" : `${remaining.toLocaleString("cs-CZ", { maximumFractionDigits: 4 })} %`} sentiment={remaining === 0 ? "positive" : "negative"} />
      <p id={allocationErrorId} role="status" className={`sm:col-span-2 text-small ${valid ? "text-success-ink" : "text-danger-ink"}`}>{allocationMessage}</p>
    </div>

    <div className="space-y-5">
      <div>
        <h4 className="text-card-title font-semibold">Otestuj jedno hypotetické období</h4>
        <p className="mt-2 text-small text-secondary">Tyto hodnoty jsou vymyšlené pro výuku. Nejde o očekávané výnosy, tržní prognózu ani záruku.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Načíst hypotetické výnosy">
        <button type="button" onClick={() => setReturns({ stocks: "8", bonds: "2", cash: "0" })} className="min-h-12 rounded-control border border-border px-4 py-3 text-left text-small font-semibold hover:bg-surface-muted">Příklad: akcie +8 %</button>
        <button type="button" onClick={() => setReturns({ stocks: "-10", bonds: "2", cash: "0" })} className="min-h-12 rounded-control border border-border px-4 py-3 text-left text-small font-semibold hover:bg-surface-muted">Akcie klesnou o 10 %</button>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {assets.map((asset) => <FinanceInput key={asset.id} label={`Hypotetický výnos · ${asset.label}`} mode="percentage" value={returns[asset.id]} onValueChange={(value) => setReturn(asset.id, value)} error={returnErrors[asset.id]} />)}
      </div>
      {Object.keys(returnErrors).length ? <p id={returnErrorId} role="alert" className="text-small text-danger-ink">Použij konečné výnosy; výnos za jedno období nemůže být nižší než −100 %.</p> : portfolioReturn === undefined ? <ConceptCard title="Nejprve dokonči rozložení">Vážený výnos se zobrazí, až budou všechna rozložení platná a jejich součet bude přesně 100 %.</ConceptCard> : <div aria-live="polite" aria-atomic="true" className="space-y-4 border-y border-border py-6">
        <MetricResult label="Hypotetický výnos portfolia za jedno období" value={formatPercent(portfolioReturn, 4)} sentiment={portfolioReturn > 0 ? "positive" : portfolioReturn < 0 ? "negative" : "neutral"} />
        <p className="break-words text-small text-secondary">{assets.map((asset, index) => `${parsed.percentages[index]}% × ${formatPercent(parsedReturns[index]!, 4)}`).join(" + ")} = {formatPercent(portfolioReturn, 4)}</p>
      </div>}
    </div>
  </section>;
}
