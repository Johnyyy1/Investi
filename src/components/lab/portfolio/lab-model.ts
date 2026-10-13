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

/* ── Groups and target drift ─────────────────────────────────────────────── */

export interface GroupSummary {
  group: Group;
  valueMinor: bigint | null;
  weightBasisPoints: number | null;
  targetBasisPoints: number | null;
  priceEffectMinor: bigint | null;
  symbols: string[];
  /** Held instruments that are not part of the saved mix (target 0 %). */
  outside: string[];
}

export function groupSummaries(view: PortfolioView): GroupSummary[] {
  const complete = view.valuationComplete && view.portfolioTotalMinor !== null;
  const targets = new Map<Group, number>();
  if (view.allocation) {
    for (const line of view.allocation.lines) targets.set(groupOf(line.assetType), (targets.get(groupOf(line.assetType)) ?? 0) + line.weightBasisPoints);
    targets.set("cash", view.allocation.cashWeightBasisPoints);
  }
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
      targetBasisPoints: view.allocation ? targets.get(group) ?? 0 : null,
      priceEffectMinor: group === "cash" ? 0n : complete ? members.reduce((sum, holding) => sum + minor(holding.priceEffectMinor ?? "0"), 0n) : null,
      symbols: members.map(({ symbol }) => symbol),
      outside: view.allocation ? members.filter(({ instrumentId }) => !view.allocation!.lines.some((line) => line.instrumentId === instrumentId)).map(({ symbol }) => symbol) : [],
    };
  });
  return rows.filter((row) => row.group === "cash" ? minor(view.availableCashMinor) > 0n || (row.targetBasisPoints ?? 0) > 0 : row.symbols.length > 0 || (row.targetBasisPoints ?? 0) > 0);
}

const DRIFT_TOLERANCE = 50;

/** Explains why weights moved away from the saved targets, using only the observed numbers. */
export function driftSentence(rows: readonly GroupSummary[]): string | null {
  const measured = rows.filter((row) => row.weightBasisPoints !== null && row.targetBasisPoints !== null);
  if (measured.length === 0) return null;
  const drifts = measured.map((row) => ({ row, drift: row.weightBasisPoints! - row.targetBasisPoints! }));
  const largest = drifts.reduce((max, item) => Math.abs(item.drift) > Math.abs(max.drift) ? item : max);
  if (Math.abs(largest.drift) < DRIFT_TOLERANCE) {
    return `Váhy jsou blízko uloženého cíle ${measured.map((row) => formatDecimal(row.targetBasisPoints! / 100, { maximumFractionDigits: 1 })).join(" / ")}. Lab nic sám nepřerovnává.`;
  }
  const { label } = groups[largest.row.group];
  const actual = percent(largest.row.weightBasisPoints);
  const target = percent(largest.row.targetBasisPoints, { digits: 0 });
  if (largest.row.group === "cash" && largest.drift > 0) {
    return `Hotovost je ${actual} místo cílových ${target}. Nový kapitál z lekcí nebo peníze z prodeje se do mixu samy nerozdělí. Rozdělí je až úprava mixu.`;
  }
  const direction = largest.drift > 0 ? "větší" : "menší";
  const outside = largest.row.outside.length && largest.drift > 0
    ? ` ${largest.row.outside.join(", ")} ${largest.row.outside.length === 1 ? "v mixu není" : "v mixu nejsou"}, přesto ${largest.row.outside.length === 1 ? "se počítá" : "se počítají"} do celku.`
    : "";
  return `${label} mají ${direction} váhu, než je cíl: ${actual} místo ${target}.${outside} Váhy se mění s cenami i s obchody mimo mix a Lab nic sám nepřerovnává.`;
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
  const sentences = moving.filter((row) => row.id !== "fx").map((row) => row.id === "realized"
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

/* ── Builder ─────────────────────────────────────────────────────────────── */

export interface MixLine {
  instrumentId: string;
  symbol: string;
  name: string;
  assetType: "equity" | "etf" | "bond";
  quoteCurrency: string;
  percent: number;
}

/** Whole percents that keep the exact sum, by largest remainder. */
export function wholePercents(basisPoints: readonly number[]) {
  const floors = basisPoints.map((value) => Math.floor(value / 100));
  let missing = Math.round(basisPoints.reduce((sum, value) => sum + value, 0) / 100) - floors.reduce((sum, value) => sum + value, 0);
  const order = basisPoints.map((value, index) => ({ index, remainder: value % 100 })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (missing <= 0) break;
    floors[index] += 1;
    missing -= 1;
  }
  return floors;
}

const asLineType = (assetType: string): MixLine["assetType"] => assetType === "bond" || assetType === "etf" ? assetType : "equity";

/** Saved targets when they exist; otherwise today's weights of what is held; otherwise empty. */
export function initialMix(view: PortfolioView): { lines: MixLine[]; cashPercent: number; source: "saved" | "holdings" | "empty" } {
  if (view.allocation) {
    const percents = wholePercents([...view.allocation.lines.map(({ weightBasisPoints }) => weightBasisPoints), view.allocation.cashWeightBasisPoints]);
    return {
      source: "saved",
      cashPercent: percents.at(-1)!,
      lines: view.allocation.lines.map((line, index) => ({ instrumentId: line.instrumentId, symbol: line.symbol, name: line.name, assetType: line.assetType, quoteCurrency: line.quoteCurrency, percent: percents[index] })),
    };
  }
  if (view.holdings.length > 0 && view.valuationComplete && view.cashWeightBasisPoints !== null) {
    const percents = wholePercents([...view.holdings.map(({ portfolioWeightBasisPoints }) => Number(portfolioWeightBasisPoints)), Number(view.cashWeightBasisPoints)]);
    return {
      source: "holdings",
      cashPercent: percents.at(-1)!,
      lines: view.holdings.map((holding, index) => ({ instrumentId: holding.instrumentId, symbol: holding.symbol, name: holding.name, assetType: asLineType(holding.assetType), quoteCurrency: holding.quoteCurrency, percent: percents[index] })),
    };
  }
  return { source: "empty", cashPercent: 0, lines: [] };
}

export type MixCheck = "empty" | "complete" | "under" | "over" | "zero-line";

export function mixCheck(lines: readonly MixLine[], cashPercent: number): { check: MixCheck; sum: number } {
  const sum = lines.reduce((total, line) => total + line.percent, cashPercent);
  if (lines.length === 0) return { check: "empty", sum };
  if (sum < 100) return { check: "under", sum };
  if (sum > 100) return { check: "over", sum };
  if (lines.some(({ percent }) => percent <= 0)) return { check: "zero-line", sum };
  return { check: "complete", sum };
}

export function amountForPercent(totalMinor: bigint, percentValue: number) {
  return (totalMinor * BigInt(Math.max(0, Math.round(percentValue)))) / 100n;
}

export function allocationInput(lines: readonly MixLine[], cashPercent: number) {
  return {
    lines: lines.map(({ instrumentId, percent: value }) => ({ instrumentId, weightBasisPoints: value * 100 })),
    cashWeightBasisPoints: cashPercent * 100,
  };
}

/** Weight given to a newly added line: whatever is still unassigned, never more. */
export function weightForNewLine(lines: readonly MixLine[], cashPercent: number) {
  const remaining = 100 - lines.reduce((sum, line) => sum + line.percent, cashPercent);
  return Math.max(0, remaining);
}

export function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
