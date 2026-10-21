import type { PortfolioView } from "@/features/portfolio/service";
import { formatPracticeCapitalMinor } from "@/features/rewards/presentation";
import { formatDecimal } from "@/lib/formatters";

/** Presentation rules for Portfolio Lab. Every number here is read from the server view;
 * nothing is estimated, and a missing value stays missing. */

export type Holding = PortfolioView["holdings"][number];
export type Group = "equity" | "etf" | "bond" | "cash";

/** Groups follow the instrument type the market-data contract exposes. An ETF's underlying
 * asset class is not part of the contract, so a bond ETF stays an ETF. */
export const groups: Record<Group, { label: string; color: string; meta: string }> = {
  equity: { label: "Akcie", color: "var(--color-viz-equity)", meta: "Akcie jedné firmy" },
  etf: { label: "ETF", color: "var(--color-viz-etf)", meta: "Fond (ETF)" },
  bond: { label: "Dluhopisy", color: "var(--color-viz-bonds)", meta: "Dluhopis" },
  cash: { label: "Hotovost", color: "var(--color-viz-cash)", meta: "Hotovost v korunách" },
};
export const groupOrder: readonly Group[] = ["equity", "etf", "bond", "cash"];

export function groupOf(assetType: string): Exclude<Group, "cash"> {
  return assetType === "bond" ? "bond" : assetType === "etf" ? "etf" : "equity";
}

export const minor = (value: string | bigint) => typeof value === "bigint" ? value : BigInt(value);
export const money = (value: string | bigint) => formatPracticeCapitalMinor(value);

/** Whole koruny for headline numbers; the exact value stays in the accessible label. */
export function wholeMoney(value: string | bigint) {
  const amount = minor(value);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  return `${negative ? "−" : ""}${formatDecimal((absolute + 50n) / 100n)} Kč`;
}

export function signedMoney(value: string | bigint) {
  const amount = minor(value);
  return `${amount > 0n ? "+" : ""}${money(amount)}`;
}

export function percent(basisPoints: string | number | bigint | null, { signed = false, digits = 1 } = {}) {
  if (basisPoints === null) return "—";
  const value = Number(basisPoints) / 100;
  const formatted = formatDecimal(Math.abs(value), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : "";
  return `${sign}${formatted} %`;
}

export function fxRate(value: string) {
  return formatDecimal(Number(value), { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

export function quantity(value: string) {
  return formatDecimal(Number(value), { maximumFractionDigits: 8 });
}

export function trend(value: string | bigint | null): "up" | "down" | "flat" | "unknown" {
  if (value === null) return "unknown";
  const amount = minor(value);
  return amount > 0n ? "up" : amount < 0n ? "down" : "flat";
}

const currencyNames: Record<string, { name: string; rose: string; fell: string }> = {
  USD: { name: "Dolar", rose: "posílil", fell: "oslabil" },
  EUR: { name: "Euro", rose: "posílilo", fell: "oslabilo" },
};

export function currencyName(currency: string) {
  return currencyNames[currency]?.name ?? currency;
}

/* ── Data status ─────────────────────────────────────────────────────────── */

export type DataStatus =
  | { kind: "none" }
  | { kind: "fresh"; observedAt: string | null }
  | { kind: "closed"; observedAt: string | null }
  | { kind: "stale"; observedAt: string | null }
  | { kind: "unavailable"; missing: number; total: number };

/** The worst state across holdings decides the page: unavailable > stale > closed > fresh. */
export function dataStatus(view: Pick<PortfolioView, "holdings">): DataStatus {
  const { holdings } = view;
  if (holdings.length === 0) return { kind: "none" };
  const missing = holdings.filter(({ marketValueMinor }) => marketValueMinor === null).length;
  if (missing > 0) return { kind: "unavailable", missing, total: holdings.length };
  const times = (status: Holding["quoteUsability"]) => holdings.filter(({ quoteUsability }) => quoteUsability === status).map(({ quoteObservedAt }) => quoteObservedAt).filter((time): time is string => Boolean(time)).sort();
  const stale = times("stale");
  if (holdings.some(({ quoteUsability }) => quoteUsability === "stale")) return { kind: "stale", observedAt: stale[0] ?? null };
  const closed = times("closed-market-reference");
  if (closed.length > 0) return { kind: "closed", observedAt: closed.at(-1) ?? null };
  const all = holdings.map(({ quoteObservedAt }) => quoteObservedAt).filter((time): time is string => Boolean(time)).sort();
  return { kind: "fresh", observedAt: all.at(-1) ?? null };
}

/* ── Groups ──────────────────────────────────────────────────────────────── */

export interface GroupSummary {
  group: Group;
  valueMinor: bigint | null;
  weightBasisPoints: number | null;
  priceEffectMinor: bigint | null;
  symbols: string[];
}

/** Value and weight per instrument type, cash included. Incomplete valuations stay null. */
export function groupSummaries(view: PortfolioView): GroupSummary[] {
  const complete = view.valuationComplete && view.portfolioTotalMinor !== null;
  const rows = groupOrder.map((group): GroupSummary => {
    const members = group === "cash" ? [] : view.holdings.filter((holding) => groupOf(holding.assetType) === group);
    const valueMinor = group === "cash" ? minor(view.availableCashMinor)
      : complete ? members.reduce((sum, holding) => sum + minor(holding.marketValueMinor!), 0n) : null;
    const weightBasisPoints = group === "cash"
      ? view.cashWeightBasisPoints === null ? null : Number(view.cashWeightBasisPoints)
      : complete ? members.reduce((sum, holding) => sum + Number(holding.portfolioWeightBasisPoints ?? 0), 0) : null;
    return {
      group,
      valueMinor,
      weightBasisPoints,
      priceEffectMinor: group === "cash" ? 0n : complete ? members.reduce((sum, holding) => sum + minor(holding.priceEffectMinor ?? "0"), 0n) : null,
      symbols: members.map(({ symbol }) => symbol),
    };
  });
  return rows.filter((row) => row.group === "cash" ? minor(view.availableCashMinor) > 0n : row.symbols.length > 0);
}

/* ── What moved the result ───────────────────────────────────────────────── */

export interface ContributionRow {
  id: string;
  label: string;
  detail: string | null;
  effectMinor: bigint;
  color: string;
}

export function contributionRows(view: PortfolioView, rows: readonly GroupSummary[]): ContributionRow[] | null {
  if (!view.attribution) return null;
  const result: ContributionRow[] = rows.filter((row) => row.group !== "cash").map((row) => ({
    id: row.group,
    label: groups[row.group].label,
    detail: row.symbols.join(", ") || null,
    effectMinor: row.priceEffectMinor ?? 0n,
    color: groups[row.group].color,
  }));
  const fx = minor(view.attribution.fxEffectMinor);
  if (view.attribution.currencies.length > 0 || fx !== 0n) {
    result.push({ id: "fx", label: view.attribution.currencies.length === 1 ? `Kurz ${view.attribution.currencies[0].currency}` : "Kurzy měn", detail: null, effectMinor: fx, color: "var(--color-viz-other)" });
  }
  const costs = minor(view.attribution.costEffectMinor ?? "0");
  if (costs !== 0n) result.push({ id: "costs", label: "Náklady otevřených pozic", detail: "Poplatky a přirážka konverze; náklady prodaných částí jsou v uzavřených prodejích.", effectMinor: costs, color: "var(--color-viz-other)" });
  const realized = minor(view.attribution.realizedGainLossMinor);
  if (realized !== 0n) result.push({ id: "realized", label: "Uzavřené prodeje", detail: null, effectMinor: realized, color: "var(--color-viz-other)" });
  if (rows.some((row) => row.group === "cash")) result.push({ id: "cash", label: "Hotovost", detail: null, effectMinor: 0n, color: groups.cash.color });
  return result;
}

export function contributionStory(view: PortfolioView, contributions: readonly ContributionRow[]) {
  const gain = view.investmentGainLossMinor === null ? null : minor(view.investmentGainLossMinor);
  if (gain === null) return null;
  const moving = contributions.filter(({ effectMinor }) => effectMinor !== 0n);
  if (moving.length === 0) {
    return { headline: "Zatím se nic nepohnulo.", sentences: ["Ceny ani kurzy se od nákupu nezměnily, proto je výsledek nula. Pohyb tu uvidíš, až se změní ceny."] };
  }
  const largest = moving.reduce((max, row) => (row.effectMinor < 0n ? -row.effectMinor : row.effectMinor) > (max.effectMinor < 0n ? -max.effectMinor : max.effectMinor) ? row : max);
  const verb = (amount: bigint) => amount > 0n ? "přidaly" : "ubraly";
  const absolute = (amount: bigint) => money(amount < 0n ? -amount : amount);
  const lead = gain > 0n ? `Přibylo ${wholeMoney(gain)}.` : gain < 0n ? `Ubylo ${wholeMoney(-gain)}.` : "Celkem beze změny.";
  const headline = `${lead} Nejvíc ${largest.id === "fx" ? "pohnul kurz" : largest.id === "realized" ? "pohnuly prodeje" : `pohnuly ${largest.label === "ETF" ? "ETF" : largest.label.toLocaleLowerCase("cs-CZ")}`}.`;
  const sentences = moving.filter((row) => row.id !== "fx").map((row) => row.id === "costs"
    ? `Poplatky a přirážka konverze otevřených pozic ubraly ${absolute(row.effectMinor)}. Náklady prodaných částí jsou zahrnuté v uzavřených prodejích.`
    : row.id === "realized"
    ? `Uzavřené prodeje ${row.effectMinor > 0n ? "přinesly" : "ubraly"} ${absolute(row.effectMinor)} oproti nákupní ceně.`
    : `${row.label}${row.detail ? ` (${row.detail})` : ""} ${verb(row.effectMinor)} ${absolute(row.effectMinor)} pohybem cen.`);
  const fx = contributions.find(({ id }) => id === "fx");
  if (fx && fx.effectMinor !== 0n && view.attribution) {
    const [only] = view.attribution.currencies;
    if (view.attribution.currencies.length === 1 && only) {
      const names = currencyNames[only.currency];
      const rose = Number(only.currentFxRate) > Number(only.purchaseFxRate);
      sentences.push(`${names?.name ?? only.currency} ${rose ? names?.rose ?? "posílil" : names?.fell ?? "oslabil"} z ${fxRate(only.purchaseFxRate)} na ${fxRate(only.currentFxRate)} Kč, přepočet ${fx.effectMinor > 0n ? "přidal" : "ubral"} ${absolute(fx.effectMinor)}.`);
    } else {
      sentences.push(`Změny kurzů měn ${verb(fx.effectMinor)} při přepočtu ${absolute(fx.effectMinor)}.`);
    }
  }
  return { headline, sentences };
}

/* ── Sector and country exposure ─────────────────────────────────────────── */

export type ExposureView = PortfolioView["exposure"]["sector"];
export type ValuedExposure = Extract<ExposureView, { status: "valued" }>;
export type ExposureRow = ValuedExposure["categories"][number];
export type SplitBy = "type" | "sector" | "country";
export const splitOptions: ReadonlyArray<{ id: SplitBy; label: string }> = [
  { id: "type", label: "Typ aktiva" },
  { id: "sector", label: "Sektor" },
  { id: "country", label: "Země" },
];

/** Provider sector names (sample data and FMP) in Czech; an unknown name is shown as reported. */
const sectorLabels: Readonly<Record<string, string>> = {
  Technology: "Technologie",
  Financials: "Finance",
  "Financial Services": "Finance",
  Industrials: "Průmysl",
  Healthcare: "Zdravotnictví",
  "Consumer goods": "Spotřební zboží",
  "Consumer Cyclical": "Cyklická spotřeba",
  "Consumer Defensive": "Základní spotřeba",
  Communication: "Komunikace",
  "Communication Services": "Komunikace",
  Energy: "Energetika",
  Materials: "Materiály",
  "Basic Materials": "Materiály",
  Utilities: "Veřejné služby",
  "Real estate": "Nemovitosti",
  "Real Estate": "Nemovitosti",
  Other: "Ostatní",
};

let regionNames: Intl.DisplayNames | null | undefined;
function countryName(code: string) {
  if (regionNames === undefined) {
    try { regionNames = new Intl.DisplayNames(["cs"], { type: "region" }); } catch { regionNames = null; }
  }
  try { return regionNames?.of(code) ?? code; } catch { return code; }
}

export function exposureLabel(dimension: Exclude<SplitBy, "type">, category: ExposureRow) {
  if (category.kind === "cash") return "Hotovost";
  if (category.kind === "unknown") return "Neznámé";
  if (dimension === "sector") return sectorLabels[category.key] ?? category.key;
  if (category.key === "Other") return "Ostatní";
  return /^[A-Z]{2}$/.test(category.key) ? countryName(category.key) : category.key;
}

const dimensionWords = {
  sector: { largest: "Největší sektor", one: "jednoho sektoru", it: "mu", none: "sektor" },
  country: { largest: "Největší země", one: "jedné země", it: "jí", none: "zemi" },
} as const;

/**
 * An explainable rule instead of a score: name the largest classified category and its share
 * of the whole portfolio, and say plainly which holdings could not be classified.
 */
export function exposureFacts(dimension: Exclude<SplitBy, "type">, exposure: ValuedExposure) {
  const words = dimensionWords[dimension];
  const largest = exposure.categories.find(({ kind }) => kind === "classified") ?? null;
  const missing = exposure.unclassified.filter(({ coverage }) => coverage === "none").map(({ symbol }) => symbol);
  const partial = exposure.unclassified.filter(({ coverage }) => coverage === "partial").map(({ symbol }) => symbol);
  const notes: string[] = [];
  if (missing.length > 0) notes.push(`${missing.join(", ")}: zdroj ${words.none} neuvádí, proto ${missing.length === 1 ? "je" : "jsou"} v kategorii Neznámé.`);
  if (partial.length > 0) notes.push(`${partial.join(", ")}: zdroj nerozepsal celý fond, nerozepsaný zbytek je v kategorii Neznámé.`);
  return {
    headline: largest ? `${words.largest}: ${exposureLabel(dimension, largest)} ${percent(largest.weightBasisPoints)}` : null,
    explanation: `Čím větší podíl ${words.one}, tím víc celé portfolio závisí na tom, jak se ${words.it} daří. ETF se počítá podle vah uvnitř fondu, akcie jedné firmy patří celá do ${words.one}.`,
    complete: exposure.unclassified.length === 0,
    notes,
  };
}
