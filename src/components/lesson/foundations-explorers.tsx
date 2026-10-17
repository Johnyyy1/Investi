"use client";

import { useId, useState } from "react";
import { FinanceInput } from "@/components/learning/finance-input";
import { ConceptCard } from "@/components/learning/concept-card";
import { MetricResult } from "@/components/learning/metric-result";
import { compoundValue, FinancialInputError, parsePrice } from "@/features/finance/returns";
import { bidAskSpread, drawdownFromPeak, marketCapitalization, ownershipPercentage, portfolioWeightedReturn, positionValue, simpleBondCashflows } from "@/features/finance/foundations";
import { Calculator } from "lucide-react";
import { formatCurrency, formatDecimal, formatPercentage } from "@/lib/formatters";

const number = (value: number) => formatDecimal(value, { maximumSignificantDigits: 8, notation: value !== 0 && (Math.abs(value) < 0.000001 || Math.abs(value) >= 1e15) ? "scientific" : "standard" });
const euros = (value: number) => formatCurrency(value, "EUR", { maximumFractionDigits: 2 });

export function GrowthComparison() {
  const [starting, setStarting] = useState("10000");
  const [rate, setRate] = useState("5");
  const [time, setTime] = useState("10");
  const errorId = useId();
  let result: { rows: { year: number; cash: number; hypothetical: number }[]; final: number } | undefined;
  let error: string | undefined;
  try {
    const start = parsePrice(starting, "Počáteční hodnota");
    const annual = parsePrice(rate, "Roční sazba");
    const years = parsePrice(time, "Čas");
    if (start <= 0 || start > 1e9) throw new FinancialInputError("Počáteční hodnota musí být větší než nula a nejvýše 1 000 000 000.");
    if (annual < -100 || annual > 100) throw new FinancialInputError("Pro tuto ilustraci použij sazbu od −100 % do 100 %.");
    if (!Number.isInteger(years) || years < 1 || years > 50) throw new FinancialInputError("Použij celé číslo let od 1 do 50.");
    const rows = Array.from({ length: years + 1 }, (_, year) => ({ year, cash: start, hypothetical: compoundValue(start, Array(year).fill(annual / 100)) }));
    result = { rows, final: rows[years].hypothetical };
  } catch (cause) { error = cause instanceof Error ? cause.message : "Zadej platné hodnoty."; }
  const invalid = { "aria-invalid": Boolean(error), "aria-describedby": error ? errorId : undefined };
  return <section aria-label="Porovnání růstu" className="space-y-6 min-w-0">
    <ConceptCard title="Matematická ilustrace">Výchozích 5 % je hypotetických, nejde o prognózu ani zaručený investiční výnos. Skutečné výnosy se liší a mohou být záporné. Scénář A předpokládá růst 0 %; hotovostní účty mohou přinášet úrok. Oba scénáře pomíjejí inflaci, poplatky, daně a další vklady.</ConceptCard>
    <div className="grid gap-5 sm:grid-cols-3"><FinanceInput {...invalid} label="Počáteční hodnota" prefix="€" value={starting} onValueChange={setStarting} /><FinanceInput {...invalid} label="Hypotetická roční sazba" mode="percentage" value={rate} onValueChange={setRate} /><FinanceInput {...invalid} label="Čas v letech" value={time} onValueChange={setTime} /></div>
    {error ? <p id={errorId} role="alert" className="text-small text-danger-ink">{error}</p> : result ? <>
      <div aria-live="polite" aria-atomic="true" className="grid min-w-0 gap-6 border-y border-border py-6 sm:grid-cols-2"><MetricResult label="Scénář A · růst 0 %" value={euros(result.rows[0].cash)} /><MetricResult label="Scénář B · hypotetický" value={euros(result.final)} /></div>
      <p className="text-small text-secondary">Roční sazba se každý rok použije na hodnotu z předchozího roku. Jde o nominální eura: tabulka neupravuje kupní sílu.</p>
      <details><summary className="cursor-pointer py-3 text-small text-primary">Zobrazit hodnoty po letech</summary><ol className="space-y-3">{result.rows.map((row) => <li key={row.year} className="border-t border-border pt-3 text-small break-words"><p className="font-semibold">Rok {row.year}</p><p>A · {euros(row.cash)}</p><p>B · {euros(row.hypothetical)}</p></li>)}</ol></details>
    </> : null}
  </section>;
}

export function ShareExplorer({ kind }: { kind: "ownership" | "market-cap" }) {
  const ownership = kind === "ownership";
  const [total, setTotal] = useState("1000000");
  const [value, setValue] = useState(ownership ? "100" : "50");
  const errorId = useId();
  let result: { amount: number; total: number; value: number } | undefined;
  let error: string | undefined;
  try {
    const shares = parsePrice(total, "Celkový počet akcií");
    const input = parsePrice(value, ownership ? "Vlastněné akcie" : "Cena akcie");
    result = { total: shares, value: input, amount: ownership ? ownershipPercentage(input, shares) : marketCapitalization(input, shares) };
  } catch (cause) { error = cause instanceof Error ? cause.message : "Zadej platné hodnoty."; }
  const invalid = { "aria-invalid": Boolean(error), "aria-describedby": error ? errorId : undefined };
  return <section aria-label={ownership ? "Průzkumník vlastnictví" : "Průzkumník tržní kapitalizace"} className="min-w-0 space-y-6">
    <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
      {ownership ? <FinanceInput {...invalid} label="Vlastněné akcie" value={value} onValueChange={setValue} /> : <FinanceInput {...invalid} label="Cena akcie" prefix="€" value={value} onValueChange={setValue} />}
      <span aria-hidden="true" className="hidden min-h-12 items-center pb-1 text-section-title font-bold text-primary-hover sm:flex">{ownership ? "÷" : "×"}</span>
      <FinanceInput {...invalid} label="Celkový počet akcií" value={total} onValueChange={setTotal} />
    </div>
    {error ? <p id={errorId} role="alert" className="rounded-control border border-danger bg-danger-soft px-4 py-3 text-small text-danger-ink">{error}</p> : result ? <div aria-live="polite" aria-atomic="true" className="rounded-surface border border-primary/35 bg-primary-soft p-5 sm:p-6">
      <div className="flex items-start gap-3"><span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface text-primary-hover"><Calculator className="size-5" /></span><MetricResult label={ownership ? "Tvůj vlastnický podíl" : "Tržní kapitalizace"} value={ownership ? `${number(result.amount)}%` : euros(result.amount)} /></div>
      <p className="mt-5 break-words rounded-control bg-surface px-4 py-3 text-small font-bold tabular-nums text-foreground">{ownership ? `${number(result.value)} vlastněných ÷ ${number(result.total)} celkem × 100 = ${number(result.amount)}%` : `${euros(result.value)} × ${number(result.total)} akcií = ${euros(result.amount)}`}</p>
      <p className="mt-3 text-small text-secondary">{ownership ? "Předpokládá stejný podíl na akcii. Samotná změna ceny akcie nemění tvůj vlastnický zlomek." : "Aktuální tržní hodnota vlastního kapitálu. Není to tržba, zisk, hotovost ani hodnota podniku."}</p>
    </div> : null}
  </section>;
}

export function StockPositionExplorer() {
  const [quantity, setQuantity] = useState("3");
  const [price, setPrice] = useState("150");
  const errorId = useId();
  let value: number | undefined;
  let error: string | undefined;
  try {
    value = positionValue(parsePrice(quantity, "Počet"), parsePrice(price, "Tržní cena"));
  } catch { error = "Zadej platné číselné hodnoty."; }
  const invalid = { "aria-invalid": Boolean(error), "aria-describedby": error ? errorId : undefined };
  return <section aria-label="Výpočet hodnoty akciové pozice" className="min-w-0 space-y-6">
    <div className="grid gap-5 sm:grid-cols-2"><FinanceInput {...invalid} label="Počet akcií" value={quantity} onValueChange={setQuantity} /><FinanceInput {...invalid} label="Tržní cena jedné akcie" prefix="Kč" value={price} onValueChange={setPrice} /></div>
    {error ? <p id={errorId} role="alert" className="text-small text-danger-ink">{error}</p> : value !== undefined ? <div aria-live="polite" aria-atomic="true" className="border-y border-border py-6"><MetricResult label="Hodnota pozice" value={formatCurrency(value, "CZK", { maximumFractionDigits: 2 })} /><p className="mt-3 text-small text-secondary">{number(Number(quantity))} akcie × {formatCurrency(Number(price), "CZK", { maximumFractionDigits: 2 })} za akcii = {formatCurrency(value, "CZK", { maximumFractionDigits: 2 })}</p></div> : null}
  </section>;
}

export function IndexEtfVisual() {
  return <figure aria-label="Index určuje měřítko, ETF drží investice a investor vlastní podíly ETF" className="space-y-3">
    <ConceptCard title="Index · určuje a měří">Firma A · Firma B · Firma C · Firma D · … Pravidla vybírají společnosti a určují jejich váhy.</ConceptCard>
    <p aria-hidden="true" className="text-center text-card-title text-secondary">↓</p>
    <ConceptCard title="ETF sledující index · snaží se ho napodobit">Fond drží investice tak, aby se přiblížil vývoji indexu. Výsledek ovlivňují náklady i odchylka sledování.</ConceptCard>
    <p aria-hidden="true" className="text-center text-card-title text-secondary">↓</p>
    <ConceptCard title="Investor · vlastní podíly ETF">Vlastníš podíly fondu, a tím získáváš expozici vůči jeho investicím.</ConceptCard>
    <figcaption className="text-small text-secondary">Firmy jsou pouze ilustrační, nejde o doporučení. Příklad ukazuje ETF sledující index; jiná ETF používají jiné strategie.</figcaption>
  </figure>;
}

const etfHoldings = [
  { label: "Firma A", weight: 45, color: "bg-primary" },
  { label: "Firma B", weight: 30, color: "bg-primary-hover" },
  { label: "Firma C", weight: 15, color: "bg-success-ink" },
  { label: "Ostatní", weight: 10, color: "bg-warning" },
] as const;

export function EtfHoldingsVisual() {
  return <figure aria-labelledby="etf-holdings-caption" className="space-y-6">
    <div role="img" aria-label="Váhy ETF: Firma A 45 %, Firma B 30 %, Firma C 15 %, ostatní 10 %" className="flex h-8 overflow-hidden rounded-pill bg-surface-muted">
      {etfHoldings.map((holding) => <span key={holding.label} aria-hidden="true" className={`h-full ${holding.color}`} style={{ width: `${holding.weight}%` }} />)}
    </div>
    <ul className="grid gap-3 min-[420px]:grid-cols-2">{etfHoldings.map((holding) => <li key={holding.label} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-small"><span className="flex items-center gap-2"><span aria-hidden="true" className={`size-3 rounded-full ${holding.color}`} />{holding.label}</span><strong className="tabular-nums">{holding.weight}%</strong></li>)}</ul>
    <figcaption id="etf-holdings-caption" className="text-small text-secondary">Dvě největší pozice tvoří 75 % tohoto modelového ETF. „Mnoho pozic“ neznamená, že jsou váhy vyvážené.</figcaption>
  </figure>;
}

export function BondCashflowExplorer() {
  const [principal, setPrincipal] = useState("1000");
  const [couponRate, setCouponRate] = useState("5");
  const [years, setYears] = useState("5");
  const errorId = useId();
  let result: ReturnType<typeof simpleBondCashflows> | undefined;
  let error: string | undefined;
  try {
    const loan = parsePrice(principal, "Jistina");
    const rate = parsePrice(couponRate, "Roční kupónová sazba");
    const term = parsePrice(years, "Roky");
    if (loan > 1e9) throw new FinancialInputError("Jistina může být pro tuto ilustraci nejvýše 1 000 000 000 €.");
    if (rate > 100) throw new FinancialInputError("Použij kupónovou sazbu od 0 % do 100 %.");
    if (!Number.isInteger(term) || term < 1 || term > 50) throw new FinancialInputError("Použij celé číslo let od 1 do 50.");
    result = simpleBondCashflows(loan, rate / 100, term);
  } catch (cause) { error = cause instanceof Error ? cause.message : "Zadej platné hodnoty."; }
  const invalid = { "aria-invalid": Boolean(error), "aria-describedby": error ? errorId : undefined };
  return <section aria-label="Ilustrace peněžních toků dluhopisu" className="space-y-6 min-w-0">
    <div className="grid gap-5 sm:grid-cols-3"><FinanceInput {...invalid} label="Jistina" prefix="€" value={principal} onValueChange={setPrincipal} /><FinanceInput {...invalid} label="Roční kupónová sazba" mode="percentage" value={couponRate} onValueChange={setCouponRate} /><FinanceInput {...invalid} label="Roky do splatnosti" value={years} onValueChange={setYears} /></div>
    {error ? <p id={errorId} role="alert" className="text-small text-danger-ink">{error}</p> : result ? <>
      <div aria-live="polite" aria-atomic="true" className="grid gap-5 border-y border-border py-6 sm:grid-cols-2">
        <MetricResult label="Roční kupón" value={euros(result.annualCoupon)} />
        <MetricResult label={`Celkem kupónů za ${years} let`} value={euros(result.totalCouponPayments)} />
        <MetricResult label="Jistina vrácená při splatnosti" value={euros(result.principalAtMaturity)} />
        <MetricResult label="Celkem přijatá nominální hotovost" value={euros(result.totalCashReceived)} />
      </div>
      <ConceptCard title="Ilustrace peněžních toků a důležité předpoklady">Předpokládá se, že emitent provede všechny slíbené platby, kupón zůstane pevný a dluhopis budeš držet do splatnosti. Pomíjí se daně, reinvestice, inflace, zaplacená cena i změny tržní ceny. Celkem není 25% investiční výnos ani výpočet výnosu do splatnosti.</ConceptCard>
    </> : null}
  </section>;
}

const assetDetails = {
  cash: { name: "Hotovost", relationship: "Okamžitě dostupné peníze", volatility: "Nominálně bývá stabilní; inflace může snížit kupní sílu", purpose: "Likvidita a využití v blízké době", payments: "Účet může podle podmínek přinášet úrok" },
  bond: { name: "Dluhopis", relationship: "Půjčka emitentovi", volatility: "Záleží na kreditním, úrokovém, inflačním a likviditním riziku", purpose: "Smluvní peněžní toky a možný příjem", payments: "Úrok a vrácení jistiny jsou slíbené, ne zaručené" },
  stock: { name: "Akcie", relationship: "Vlastnický podíl ve firmě", volatility: "Nejistota podnikání i trhu; cena může výrazně kolísat", purpose: "Možný růst firmy a případný příjem", payments: "Změna ceny a případně vyplacené dividendy" },
} as const;

export function AssetComparison() {
  const [asset, setAsset] = useState<keyof typeof assetDetails>("cash");
  const detail = assetDetails[asset];
  return <section aria-label="Porovnání hotovosti, dluhopisu a akcie" className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Vyber aktivum k porovnání">
      {(Object.keys(assetDetails) as (keyof typeof assetDetails)[]).map((key) => <button key={key} type="button" onClick={() => setAsset(key)} aria-pressed={asset === key} className={`rounded-control border px-4 py-3 text-left text-small font-semibold transition-colors ${asset === key ? "border-primary bg-surface-muted text-primary" : "border-border hover:bg-surface-muted"}`}>{assetDetails[key].name}</button>)}
    </div>
    <div aria-live="polite" className="grid gap-4 border-y border-border py-6 sm:grid-cols-2">
      <MetricResult label="Vztah" value={detail.relationship} />
      <MetricResult label="Chování a riziko" value={detail.volatility} />
      <MetricResult label="Obvyklý účel" value={detail.purpose} />
      <MetricResult label="Možné platby nebo výsledek" value={detail.payments} />
    </div>
  </section>;
}

const marketChoices = {
  buy: { label: "Koupit hned", title: "Obchoduješ na ask", detail: "Okamžitý kupující se obvykle potká s nejnižší aktuální nabídkou prodávajících: ask 100,20 Kč. Tržní pokyn upřednostňuje provedení, přesnou cenu ale nezaručuje." },
  sell: { label: "Prodat hned", title: "Obchoduješ na bid", detail: "Okamžitý prodávající se obvykle potká s nejvyšší aktuální poptávkou kupujících: bid 99,80 Kč. Zobrazený bid není slib, že se za tuto cenu provedou všechny kusy." },
  limit: { label: "Nastavit limit", title: "Určuješ cenovou podmínku", detail: "Limitní nákup na 100 Kč říká, že koupíš jen za 100 Kč nebo levněji. Pokyn se nemusí provést vůbec." },
} as const;

export function MarketQuoteExplorer() {
  const [choice, setChoice] = useState<keyof typeof marketChoices>("buy");
  const selected = marketChoices[choice];
  return <section aria-label="Práce s cenami bid a ask" className="space-y-6">
    <div className="grid gap-5 border-y border-border py-6 sm:grid-cols-3"><MetricResult label="Bid · aktuální poptávka" value="99,80 Kč" /><MetricResult label="Ask · aktuální nabídka" value="100,20 Kč" /><MetricResult label="Spread bid–ask" value={formatCurrency(bidAskSpread(99.8, 100.2), "CZK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /></div>
    <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Vyber tržní pokyn">
      {(Object.keys(marketChoices) as (keyof typeof marketChoices)[]).map((key) => <button key={key} type="button" onClick={() => setChoice(key)} aria-pressed={choice === key} className={`rounded-control border px-4 py-3 text-left text-small font-semibold transition-colors ${choice === key ? "border-primary bg-surface-muted text-primary" : "border-border hover:bg-surface-muted"}`}>{marketChoices[key].label}</button>)}
    </div>
    <ConceptCard title={selected.title}>{selected.detail}</ConceptCard>
  </section>;
}

const riskScenarios = {
  steady: { name: "Investice A", outcomes: [4, 5, 6], description: "Každý stejně pravděpodobný výsledek je blízko 5 %." },
  wide: { name: "Investice B", outcomes: [-20, 5, 30], description: "Průměr stejně pravděpodobných výsledků je stále 5 %, ale možné rozpětí je mnohem širší." },
} as const;

const signedPercent = (value: number) => `${value > 0 ? "+" : ""}${value}%`;

export function RiskScenarioExplorer() {
  const [scenario, setScenario] = useState<keyof typeof riskScenarios>("steady");
  const selected = riskScenarios[scenario];
  const average = selected.outcomes.reduce((sum, value) => sum + value, 0) / selected.outcomes.length;
  return <section aria-label="Průzkumník rizikových scénářů" className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Vyber investiční scénář">
      {(Object.keys(riskScenarios) as (keyof typeof riskScenarios)[]).map((key) => <button key={key} type="button" onClick={() => setScenario(key)} aria-pressed={scenario === key} className={`rounded-control border px-4 py-3 text-left text-small font-semibold transition-colors ${scenario === key ? "border-primary bg-surface-muted text-primary" : "border-border hover:bg-surface-muted"}`}>{riskScenarios[key].name}</button>)}
    </div>
    <div aria-live="polite" className="grid gap-5 border-y border-border py-6 sm:grid-cols-3"><MetricResult label="Nejhorší uvedený výsledek" value={signedPercent(Math.min(...selected.outcomes))} sentiment="negative" /><MetricResult label="Nejlepší uvedený výsledek" value={signedPercent(Math.max(...selected.outcomes))} sentiment="positive" /><MetricResult label="Jednoduchý průměr výsledků" value={signedPercent(average)} /></div>
    <ConceptCard title={selected.name}>{selected.description} Jde o záměrně jednoduchou ilustraci se stejnou pravděpodobností, ne o prognózu. Podobný očekávaný výsledek může mít velmi odlišnou nejistotu a ztráty.</ConceptCard>
  </section>;
}

export function DrawdownExplorer() {
  const [peak, setPeak] = useState("10000");
  const [current, setCurrent] = useState("7500");
  const errorId = useId();
  let drawdown: number | undefined;
  let error: string | undefined;
  try {
    const peakValue = parsePrice(peak, "Vrcholová hodnota");
    const currentValue = parsePrice(current, "Aktuální hodnota");
    if (peakValue > 1e9 || currentValue > 1e9) throw new FinancialInputError("Pro tuto ilustraci použij hodnoty nejvýše 1 000 000 000 €.");
    drawdown = drawdownFromPeak(peakValue, currentValue);
  } catch (cause) { error = cause instanceof Error ? cause.message : "Zadej platné hodnoty."; }
  const invalid = { "aria-invalid": Boolean(error), "aria-describedby": error ? errorId : undefined };
  return <section aria-label="Průzkumník propadu" className="space-y-6">
    <div className="grid gap-5 sm:grid-cols-2"><FinanceInput {...invalid} label="Předchozí vrcholová hodnota" prefix="€" value={peak} onValueChange={setPeak} /><FinanceInput {...invalid} label="Aktuální hodnota" prefix="€" value={current} onValueChange={setCurrent} /></div>
    {error ? <p id={errorId} role="alert" className="text-small text-danger-ink">{error}</p> : drawdown !== undefined ? <div aria-live="polite" aria-atomic="true" className="border-y border-border py-6"><MetricResult label="Propad od uvedeného vrcholu" value={formatPercentage(drawdown)} /><p className="mt-3 text-small text-secondary">Propad (drawdown) je pokles od předchozího vrcholu. Pokud je aktuální hodnota na uvedeném vrcholu nebo nad ním, ilustrace ukáže propad 0 %.</p></div> : null}
  </section>;
}

const liquidityExamples = {
  highlyTraded: { name: "Likvidní akcie velké společnosti", detail: "Obvykle existuje mnoho aktivních kupujících a prodávajících. Menší množství lze snáze obchodovat poblíž převládající tržní ceny, často s užším spreadem. Akcie přesto může ztratit hodnotu." },
  thinlyTraded: { name: "Málo obchodovaný neznámý instrument", detail: "Méně aktivních účastníků může znamenat širší spread nebo větší dopad na cenu při obchodování. Může být těžší rychle prodat poblíž očekávané ceny. Nižší likvidita neříká, jaký bude budoucí výnos." },
} as const;

export function LiquidityComparison() {
  const [example, setExample] = useState<keyof typeof liquidityExamples>("highlyTraded");
  const selected = liquidityExamples[example];
  return <section aria-label="Porovnání likvidity" className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Vyber podmínky obchodování k porovnání">
      {(Object.keys(liquidityExamples) as (keyof typeof liquidityExamples)[]).map((key) => <button key={key} type="button" onClick={() => setExample(key)} aria-pressed={example === key} className={`rounded-control border px-4 py-3 text-left text-small font-semibold transition-colors ${example === key ? "border-primary bg-surface-muted text-primary" : "border-border hover:bg-surface-muted"}`}>{liquidityExamples[key].name}</button>)}
    </div>
    <ConceptCard title={selected.name}>{selected.detail}</ConceptCard>
  </section>;
}

const concentrationExamples = {
  oneCompany: { name: "Portfolio A · jedna společnost", detail: "Problémy jedné společnosti mohou ovládnout celý výsledek. Toto portfolio má vyšší koncentrační riziko specifické pro společnost." },
  spread: { name: "Portfolio B · více investic", detail: "Řada investic může snížit závislost na jedné společnosti. Stále však mohou klesat společně a zůstává tržní riziko." },
} as const;

export function DiversificationPreview() {
  const [example, setExample] = useState<keyof typeof concentrationExamples>("oneCompany");
  const selected = concentrationExamples[example];
  return <section aria-label="Náhled diverzifikace" className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Vyber příklad koncentrace portfolia">
      {(Object.keys(concentrationExamples) as (keyof typeof concentrationExamples)[]).map((key) => <button key={key} type="button" onClick={() => setExample(key)} aria-pressed={example === key} className={`rounded-control border px-4 py-3 text-left text-small font-semibold transition-colors ${example === key ? "border-primary bg-surface-muted text-primary" : "border-border hover:bg-surface-muted"}`}>{concentrationExamples[key].name}</button>)}
    </div>
    <ConceptCard title={selected.name}>{selected.detail}</ConceptCard>
  </section>;
}

const horizonExamples = {
  soon: { name: "Peníze potřebuji za 3 měsíce", detail: "Ztráta krátce před plánovaným výdajem by nemusela mít čas se napravit. Pro tento blízký cíl jsou důležité hlavně likvidita a stabilita." },
  later: { name: "Peníze nebudu potřebovat 15 let", detail: "Delší horizont dává více času nejistým výsledkům i složenému zhodnocení. Nezaručuje však zisk a nedělá každou investici vhodnou." },
} as const;

export function TimeHorizonExplorer() {
  const [example, setExample] = useState<keyof typeof horizonExamples>("soon");
  const selected = horizonExamples[example];
  return <section aria-label="Porovnání časových horizontů" className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Vyber časový horizont">
      {(Object.keys(horizonExamples) as (keyof typeof horizonExamples)[]).map((key) => <button key={key} type="button" onClick={() => setExample(key)} aria-pressed={example === key} className={`rounded-control border px-4 py-3 text-left text-small font-semibold transition-colors ${example === key ? "border-primary bg-surface-muted text-primary" : "border-border hover:bg-surface-muted"}`}>{horizonExamples[key].name}</button>)}
    </div>
    <ConceptCard title={selected.name}>{selected.detail}</ConceptCard>
  </section>;
}

const diversificationScenarios = {
  company: { label: "Klesne jen firma A", returns: [-0.4, 0, 0, 0], detail: "Firma A klesne o 40 %, ostatní tři modelové firmy se nezmění." },
  broad: { label: "Klesnou všechny čtyři", returns: [-0.2, -0.2, -0.2, -0.2], detail: "Všechny čtyři modelové firmy klesnou společně o 20 %." },
} as const;

export function DiversificationImpact() {
  const [scenario, setScenario] = useState<keyof typeof diversificationScenarios>("company");
  const selected = diversificationScenarios[scenario];
  const concentrated = portfolioWeightedReturn([1, 0, 0, 0], selected.returns);
  const spread = portfolioWeightedReturn([0.25, 0.25, 0.25, 0.25], selected.returns);
  return <section aria-label="Vliv diverzifikace" className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Vyber modelový scénář výnosů">
      {(Object.keys(diversificationScenarios) as (keyof typeof diversificationScenarios)[]).map((key) => <button key={key} type="button" aria-pressed={scenario === key} onClick={() => setScenario(key)} className={`min-h-12 rounded-control border px-4 py-3 text-left text-small font-semibold transition-colors ${scenario === key ? "border-primary bg-surface-muted text-primary" : "border-border hover:bg-surface-muted"}`}>{diversificationScenarios[key].label}</button>)}
    </div>
    <p className="text-small text-secondary">{selected.detail} Jde o zjednodušený příklad za jedno období, ne o předpověď.</p>
    <div aria-live="polite" aria-atomic="true" className="grid gap-5 border-y border-border py-6 sm:grid-cols-2">
      <MetricResult label="Portfolio A · 100 % ve firmě A" value={formatPercentage(concentrated)} sentiment="negative" />
      <MetricResult label="Portfolio B · 25 % v každé firmě" value={formatPercentage(spread)} sentiment="negative" />
    </div>
    <ConceptCard title={scenario === "company" ? "Jedna firma má menší vliv" : "Diverzifikace neodstraní plošný pokles"}>{scenario === "company" ? "V portfoliu B má pokles firmy A o 40 % dopad −10 %: 25 % × −40 %. Více pozic není automaticky lepší diverzifikace; jejich expozice se musí skutečně lišit." : "Když všechny čtyři pozice klesnou společně, v tomto příkladu klesnou obě portfolia. Také skutečné investice se mohou pohybovat spolu."}</ConceptCard>
  </section>;
}

const portfolioHorizons = {
  soon: { label: "Peníze potřebuji za 6 měsíců", timing: "Blízká potřeba", capacity: "Ztráta může narušit plánované použití dříve, než bude čas, aby se okolnosti změnily." },
  later: { label: "Peníze nebudu potřebovat 20 let", timing: "Delší horizont", capacity: "Více času může usnadnit snášení kolísání, nezaručuje však zotavení ani zisk." },
} as const;

export function PortfolioHorizonScenario() {
  const [horizon, setHorizon] = useState<keyof typeof portfolioHorizons>("soon");
  const selected = portfolioHorizons[horizon];
  return <section aria-label="Scénář časového horizontu portfolia" className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Vyber, kdy budeš peníze potřebovat">
      {(Object.keys(portfolioHorizons) as (keyof typeof portfolioHorizons)[]).map((key) => <button key={key} type="button" aria-pressed={horizon === key} onClick={() => setHorizon(key)} className={`min-h-12 rounded-control border px-4 py-3 text-left text-small font-semibold transition-colors ${horizon === key ? "border-primary bg-surface-muted text-primary" : "border-border hover:bg-surface-muted"}`}>{portfolioHorizons[key].label}</button>)}
    </div>
    <div aria-live="polite" className="grid gap-5 border-y border-border py-6 sm:grid-cols-2"><MetricResult label="Načasování" value={selected.timing} /><MetricResult label="Proč na něm záleží" value={selected.capacity} /></div>
    <p className="text-small text-secondary">Tento scénář ukazuje, proč do úvah o portfoliu patří načasování. Nepředepisuje žádné rozložení.</p>
  </section>;
}

const riskContext = {
  tolerance: { label: "Emoční reakce", title: "Tolerance k riziku", detail: "„Nepropadl bych panice, kdyby portfolio kleslo o 30 %.“ Popisuje ochotu emočně snášet ztrátu a nejistotu." },
  capacity: { label: "Finanční potřeba", title: "Kapacita pro riziko", detail: "„Tyto peníze budu potřebovat příští rok.“ To může omezit finanční schopnost snést ztrátu, i když člověk tržní výkyvy vnímá klidně." },
  together: { label: "Zvaž obojí", title: "Tolerance nestačí", detail: "Rozhodování o portfoliu zahrnuje ochotu i finanční schopnost snést ztrátu spolu s cíli, likviditou a časovým horizontem. Tato lekce neposuzuje vhodnost investice." },
} as const;

export function RiskCapacityScenario() {
  const [context, setContext] = useState<keyof typeof riskContext>("tolerance");
  const selected = riskContext[context];
  return <section aria-label="Scénář tolerance a kapacity pro riziko" className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Prozkoumej kontext rizika této osoby">
      {(Object.keys(riskContext) as (keyof typeof riskContext)[]).map((key) => <button key={key} type="button" aria-pressed={context === key} onClick={() => setContext(key)} className={`min-h-12 rounded-control border px-4 py-3 text-left text-small font-semibold transition-colors ${context === key ? "border-primary bg-surface-muted text-primary" : "border-border hover:bg-surface-muted"}`}>{riskContext[key].label}</button>)}
    </div>
    <ConceptCard title={selected.title}>{selected.detail}</ConceptCard>
  </section>;
}
