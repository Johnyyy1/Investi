"use client";

import { useId, useState } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { FinanceInput } from "@/components/learning/finance-input";
import { MetricResult } from "@/components/learning/metric-result";
import { parseNumericAnswer } from "@/features/lessons/question-evaluation";
import { basisPointsToPercent, concentrationSample, exposureSamples, largestExposure, lessonInstruments, lookThrough, lookThroughPresets, MAX_POSITION_PERCENT, positionWeights, singlePositionImpact, twoAssetVolatility, type ExposureRow, type ExposureView, type LessonInstrument } from "@/features/lessons/diversification/model";
import { cn } from "@/lib/utils";

const number = (value: number, digits = 2) => new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const percent = (value: number, digits = 1) => `${value < 0 ? "−" : ""}${number(Math.abs(value), digits)} %`;
const crowns = (value: number) => `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(value)} Kč`;
const toggleClass = (active: boolean) => cn("min-h-12 rounded-control border px-4 py-2 text-left text-small font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary-hover", active ? "border-primary bg-primary-soft text-primary" : "border-border-strong bg-surface text-foreground hover:bg-surface-muted");

function Toggle<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { id: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <div role="group" aria-label={label} className="flex flex-wrap gap-2">
    {options.map((option) => <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)} className={toggleClass(value === option.id)}>{option.label}</button>)}
  </div>;
}

/** A rule result in words and an icon, never colour alone. */
export function RuleStatus({ pass }: { pass: boolean }) {
  return <span className={cn("inline-flex items-center gap-1.5 font-semibold", pass ? "text-success-ink" : "text-danger-ink")}>
    {pass ? <CircleCheck aria-hidden="true" className="size-4 shrink-0" /> : <CircleX aria-hidden="true" className="size-4 shrink-0" />}{pass ? "Splněno" : "Nesplněno"}
  </span>;
}

const viewLabels: Record<ExposureView, { option: string; list: string }> = {
  company: { option: "Firma", list: "firmy" },
  sector: { option: "Sektor", list: "sektoru" },
  country: { option: "Země", list: "země" },
};

/** Exposure rows as a list with proportional bars; the bars are decoration, the numbers carry the meaning. */
function ExposureList({ rows, view, instruments }: { rows: readonly ExposureRow[]; view: ExposureView; instruments: Record<string, LessonInstrument> }) {
  const max = Math.max(...rows.map((row) => row.percent), 1);
  const label = (row: ExposureRow) => row.kind === "cash" ? "Hotovost" : row.kind === "unknown" ? "Neznámé" : row.key;
  return <ul aria-label={`Rozložení podle ${viewLabels[view].list}`} className="divide-y divide-border border-y border-border">
    {rows.map((row) => <li key={`${row.kind}:${row.key}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 py-3">
      <span className="min-w-0 font-semibold">{label(row)}</span>
      <strong className="tabular-nums">{percent(row.percent)}</strong>
      {row.kind !== "cash" && row.contributions.length > 1 ? <small className="col-span-2 text-microcopy text-secondary">{row.contributions.map((contribution) => `${instruments[contribution.instrumentId]?.label ?? contribution.instrumentId} ${percent(contribution.percent)}`).join(" · ")}</small> : null}
      <span aria-hidden="true" className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(1, row.percent / max * 100)}%` }} /></span>
    </li>)}
  </ul>;
}

/** Five editable holdings: weights, the largest one against the teaching threshold, and the impact of its fall. */
export function ConcentrationExplorer() {
  const [inputs, setInputs] = useState<string[]>(concentrationSample.map((position) => String(position.value)));
  const [fall, setFall] = useState("40");
  const errorId = useId();
  const parsed = inputs.map(parseNumericAnswer);
  const valid = parsed.every((value) => Number.isFinite(value) && value >= 0 && value <= 10_000_000) && parsed.some((value) => value > 0);
  const fallValue = parseNumericAnswer(fall);
  const fallValid = Number.isFinite(fallValue) && fallValue >= 0 && fallValue <= 100;
  const weights = valid ? positionWeights(concentrationSample.map((position, index) => ({ id: position.id, value: parsed[index] }))) : null;
  const largest = weights?.largest ?? null;
  const largestPercent = largest ? basisPointsToPercent(largest.weightBasisPoints) : 0;
  const labelOf = (id: string) => concentrationSample.find((position) => position.id === id)!.label;
  return <section aria-label="Průzkumník koncentrace" className="min-w-0 space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {concentrationSample.map((position, index) => <FinanceInput key={position.id} label={position.label} mode="currency" suffix="Kč" value={inputs[index]} aria-describedby={valid ? undefined : errorId} aria-invalid={!valid && !(Number.isFinite(parsed[index]) && parsed[index] >= 0)} onValueChange={(value) => setInputs((current) => current.map((item, position) => position === index ? value : item))} />)}
    </div>
    {!weights || !largest ? <p id={errorId} role="alert" className="text-small text-danger-ink">Zadej hodnoty v korunách, žádnou zápornou a aspoň jednu větší než nula.</p> : <div aria-live="polite" className="space-y-5">
      <ul aria-label="Váhy pozic" className="divide-y divide-border border-y border-border">
        {weights.rows.map((row) => <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
          <span className="font-semibold">{labelOf(row.id)} · {crowns(row.value)}</span>
          <span className="text-small tabular-nums text-secondary">Váha: {percent(basisPointsToPercent(row.weightBasisPoints))}</span>
        </li>)}
      </ul>
      <div className="grid gap-5 sm:grid-cols-2">
        <MetricResult label="Hodnota portfolia" value={crowns(weights.totalCrowns)} />
        <div className="min-w-0">
          <p className="text-small text-secondary">Největší pozice: {labelOf(largest.id)}</p>
          <p className="mt-1 text-section-title font-semibold tabular-nums">{percent(largestPercent)}</p>
          <p className="mt-1 text-microcopy text-secondary">Cíl: ≤ {MAX_POSITION_PERCENT} % · <RuleStatus pass={largestPercent <= MAX_POSITION_PERCENT} /></p>
        </div>
      </div>
      <FinanceInput className="sm:max-w-sm" label={`Pokles pozice ${labelOf(largest.id)}`} mode="percentage" value={fall} onValueChange={setFall} error={fallValid ? undefined : "Zadej číslo od 0 do 100."} hint={fallValid ? "Ostatní pozice se nezmění." : undefined} />
      {fallValid ? <MetricResult label="Výnos celého portfolia" value={percent(singlePositionImpact(largestPercent, -fallValue / 100) * 100, 2)} sentiment={fallValue > 0 ? "negative" : "neutral"} note={`${percent(largestPercent)} × ${percent(-fallValue, 0)}`} /> : null}
    </div>}
  </section>;
}

const exposureViews = [{ id: "sector", label: "Sektor" }, { id: "country", label: "Země" }] as const satisfies readonly { id: ExposureView; label: string }[];

/** Two invented portfolios of five direct stocks, split by sector or by country with Portfolio Lab's function. */
export function ExposureExplorer() {
  const [sampleId, setSampleId] = useState<keyof typeof exposureSamples>("tech");
  const [view, setView] = useState<"sector" | "country">("sector");
  const sample = exposureSamples[sampleId];
  const rows = lookThrough(sample.allocation, view, sample.instruments);
  const largest = largestExposure(rows);
  return <section aria-label="Průzkumník sektorů a zemí" className="min-w-0 space-y-6">
    <Toggle label="Vyber portfolio" options={(Object.keys(exposureSamples) as (keyof typeof exposureSamples)[]).map((id) => ({ id, label: exposureSamples[id].label }))} value={sampleId} onChange={setSampleId} />
    <ul aria-label="Pozice v portfoliu" className="text-small text-secondary">
      {Object.entries(sample.instruments).map(([id, instrument]) => <li key={id}>{instrument.label} · {sample.allocation[id as keyof typeof sample.allocation]} % · {instrument.description.replace("Akcie jedné firmy · ", "")}</li>)}
      <li>Hotovost · 10 %</li>
    </ul>
    <Toggle label="Rozložení podle" options={exposureViews} value={view} onChange={setView} />
    <div aria-live="polite" className="space-y-5">
      <ExposureList rows={rows} view={view} instruments={sample.instruments} />
      {largest ? <MetricResult label={view === "sector" ? "Největší sektor" : "Největší země"} value={`${largest.key} ${percent(largest.percent)}`} note="Největší jednotlivá firma má přitom jen 18 %." /> : null}
    </div>
  </section>;
}

const lookThroughViews = [{ id: "company", label: "Firma" }, { id: "sector", label: "Sektor" }, { id: "country", label: "Země" }] as const satisfies readonly { id: ExposureView; label: string }[];

/** Preset portfolios of ETFs and stocks, looked through by company, sector or country. */
export function LookThroughExplorer() {
  const [presetId, setPresetId] = useState<keyof typeof lookThroughPresets>("overlap");
  const [view, setView] = useState<ExposureView>("company");
  const preset = lookThroughPresets[presetId];
  const rows = lookThrough(preset.allocation, view);
  const largest = largestExposure(rows);
  return <section aria-label="Průzkumník pohledu dovnitř ETF" className="min-w-0 space-y-6">
    <Toggle label="Vyber portfolio" options={(Object.keys(lookThroughPresets) as (keyof typeof lookThroughPresets)[]).map((id) => ({ id, label: lookThroughPresets[id].label }))} value={presetId} onChange={setPresetId} />
    <ul aria-label="Položky portfolia" className="text-small text-secondary">
      {Object.entries(preset.allocation).map(([id, weight]) => <li key={id}>{lessonInstruments[id as keyof typeof lessonInstruments].label} · {weight} % · {lessonInstruments[id as keyof typeof lessonInstruments].description}</li>)}
    </ul>
    <Toggle label="Pohled dovnitř podle" options={lookThroughViews} value={view} onChange={setView} />
    <div aria-live="polite" className="space-y-5">
      <ExposureList rows={rows} view={view} instruments={lessonInstruments} />
      {largest ? <MetricResult label={view === "company" ? "Největší jednotlivá firma" : view === "sector" ? "Největší sektor" : "Největší země"} value={`${largest.key} ${percent(largest.percent)}`} note={view === "company" ? "Ostatní firmy jsou stovky malých podílů, žádná z nich se nepočítá jako jedna firma." : undefined} /> : null}
    </div>
  </section>;
}

const correlationSteps = [-1, -0.5, 0, 0.5, 1] as const;
const VOLATILITY = { first: 0.2, second: 0.1 } as const;

/** Two assets with fixed volatilities: the portfolio volatility for a chosen correlation and weight. */
export function PortfolioCorrelationExplorer() {
  const [correlationIndex, setCorrelationIndex] = useState(3);
  const [weight, setWeight] = useState(50);
  const correlationId = useId(), weightId = useId();
  const rho = correlationSteps[correlationIndex];
  const portfolio = twoAssetVolatility(weight / 100, VOLATILITY.first, VOLATILITY.second, rho);
  const average = weight / 100 * VOLATILITY.first + (1 - weight / 100) * VOLATILITY.second;
  const rhoLabel = `${rho < 0 ? "−" : rho > 0 ? "+" : ""}${number(Math.abs(rho), 1)}`;
  return <section aria-label="Průzkumník volatility portfolia" className="min-w-0 space-y-6">
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <label htmlFor={correlationId} className="mb-2 block text-small font-bold">Korelace A a B: {rhoLabel}</label>
        <input id={correlationId} type="range" min={0} max={correlationSteps.length - 1} step={1} value={correlationIndex} onChange={(event) => setCorrelationIndex(Number(event.target.value))} aria-valuetext={`korelace ${rhoLabel}`} className="h-12 w-full cursor-pointer accent-primary" />
      </div>
      <div>
        <label htmlFor={weightId} className="mb-2 block text-small font-bold">Váha A: {weight} % · B: {100 - weight} %</label>
        <input id={weightId} type="range" min={0} max={100} step={10} value={weight} onChange={(event) => setWeight(Number(event.target.value))} aria-valuetext={`A ${weight} %, B ${100 - weight} %`} className="h-12 w-full cursor-pointer accent-primary" />
      </div>
    </div>
    <p className="text-small text-secondary">Investice A má volatilitu 20 % ročně, B 10 % ročně.</p>
    <div aria-live="polite" aria-atomic="true" className="grid gap-5 border-y border-border py-6 sm:grid-cols-3">
      <MetricResult label="Volatilita portfolia" value={percent(portfolio * 100, 2)} />
      <MetricResult label="Vážený průměr volatilit" value={percent(average * 100, 2)} note="Platí jen při korelaci +1." />
      <MetricResult label="Snížení díky rozložení" value={`${number((average - portfolio) * 100)} p. b.`} note={rho === 1 ? "Při korelaci +1 se nic nevyruší." : "Vážený průměr minus volatilita portfolia."} />
    </div>
  </section>;
}
