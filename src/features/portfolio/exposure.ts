import { allocationBasisPoints } from "./domain";
import { WEIGHT_SCALE } from "./decimal";

/**
 * Sector and country exposure of the whole portfolio, cash included. An equity puts all of
 * its value into its own sector and country; an ETF is looked through by its reported
 * weights. Whatever cannot be classified lands in "unknown" and is never dropped, so the
 * category values always add up exactly to the portfolio total.
 */
export type ExposureDimension = "sector" | "country";
export const UNKNOWN_EXPOSURE = "unknown";
export const CASH_EXPOSURE = "cash";

/** One classification row; `weightUnits` is a share of the instrument at WEIGHT_SCALE. */
export interface ExposureWeight {
  key: string;
  weightUnits: bigint;
}

export interface ExposureHoldingInput {
  instrumentId: string;
  /** Server-determined market value in base minor units; null while the quote or FX is missing. */
  marketValueMinor: bigint | null;
  /** null when the source gives no classification for this instrument. */
  breakdown: readonly ExposureWeight[] | null;
}

export interface ExposureContribution {
  instrumentId: string;
  valueMinor: bigint;
}

export interface ExposureCategory {
  key: string;
  kind: "classified" | "unknown" | "cash";
  valueMinor: bigint;
  /** Share of the whole portfolio, rounded per category like every other portfolio weight. */
  weightBasisPoints: bigint;
  contributions: ExposureContribution[];
}

export type PortfolioExposure =
  | { status: "unvalued"; missingInstrumentIds: string[] }
  | {
    status: "valued";
    totalMinor: bigint;
    categories: ExposureCategory[];
    /** "none": nothing is classified; "partial": the reported weights cover less than 100 %. */
    unclassified: Array<{ instrumentId: string; coverage: "none" | "partial" }>;
  };

/** Largest-remainder split of `total` by integer parts; the result always sums to `total`. */
export function apportion(total: bigint, parts: readonly bigint[]): bigint[] {
  if (total < 0n) throw new RangeError("Only non-negative amounts can be apportioned.");
  if (parts.some((part) => part < 0n)) throw new RangeError("Parts must be non-negative.");
  const denominator = parts.reduce((sum, part) => sum + part, 0n);
  if (denominator === 0n) throw new RangeError("At least one part must be positive.");
  const shares = parts.map((part) => (total * part) / denominator);
  let left = total - shares.reduce((sum, share) => sum + share, 0n);
  const order = parts
    .map((part, index) => ({ index, remainder: (total * part) % denominator }))
    .sort((a, b) => (b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : a.index - b.index));
  for (const { index } of order) {
    if (left === 0n) break;
    shares[index] += 1n;
    left -= 1n;
  }
  return shares;
}

const countryCodes: Readonly<Record<string, string>> = {
  "united states": "US", "united states of america": "US", usa: "US", japan: "JP", "united kingdom": "GB", "great britain": "GB",
  china: "CN", canada: "CA", france: "FR", germany: "DE", switzerland: "CH", india: "IN", taiwan: "TW", australia: "AU",
  "south korea": "KR", korea: "KR", "korea, republic of": "KR", netherlands: "NL", sweden: "SE", denmark: "DK", italy: "IT",
  spain: "ES", brazil: "BR", "hong kong": "HK", ireland: "IE", belgium: "BE", finland: "FI", norway: "NO", singapore: "SG",
  israel: "IL", "south africa": "ZA", mexico: "MX", austria: "AT", "czech republic": "CZ", czechia: "CZ", poland: "PL",
};

/** Equities report ISO codes ("US"), fund breakdowns report names ("United States"); both meet on the ISO code. */
export function exposureKey(dimension: ExposureDimension, name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (dimension === "sector") return trimmed;
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return countryCodes[trimmed.toLowerCase()] ?? trimmed;
}

function byValue(a: ExposureCategory, b: ExposureCategory) {
  const rank = (category: ExposureCategory) => (category.kind === "classified" ? 0 : category.kind === "unknown" ? 1 : 2);
  return rank(a) - rank(b) || (b.valueMinor > a.valueMinor ? 1 : b.valueMinor < a.valueMinor ? -1 : a.key.localeCompare(b.key));
}

export function portfolioExposure(cashMinor: bigint, holdings: readonly ExposureHoldingInput[]): PortfolioExposure {
  const missingInstrumentIds = holdings.filter(({ marketValueMinor }) => marketValueMinor === null).map(({ instrumentId }) => instrumentId);
  if (missingInstrumentIds.length > 0) return { status: "unvalued", missingInstrumentIds };
  if (cashMinor < 0n) throw new RangeError("Cash cannot be negative.");

  const categories = new Map<string, ExposureCategory>();
  const add = (key: string, kind: ExposureCategory["kind"], instrumentId: string, valueMinor: bigint) => {
    if (valueMinor === 0n) return;
    const id = `${kind}:${key}`;
    const category = categories.get(id) ?? { key, kind, valueMinor: 0n, weightBasisPoints: 0n, contributions: [] };
    category.valueMinor += valueMinor;
    const existing = category.contributions.find((contribution) => contribution.instrumentId === instrumentId);
    if (existing) existing.valueMinor += valueMinor;
    else category.contributions.push({ instrumentId, valueMinor });
    categories.set(id, category);
  };
  const unclassified: Array<{ instrumentId: string; coverage: "none" | "partial" }> = [];

  for (const holding of holdings) {
    const valueMinor = holding.marketValueMinor!;
    const merged = new Map<string, bigint>();
    for (const { key, weightUnits } of holding.breakdown ?? []) {
      if (weightUnits < 0n) throw new RangeError("Exposure weights must be non-negative.");
      if (weightUnits === 0n) continue;
      merged.set(key, (merged.get(key) ?? 0n) + weightUnits);
    }
    if (merged.size === 0) {
      unclassified.push({ instrumentId: holding.instrumentId, coverage: "none" });
      add(UNKNOWN_EXPOSURE, "unknown", holding.instrumentId, valueMinor);
      continue;
    }
    const keys = [...merged.keys()];
    const weights = [...merged.values()];
    const covered = weights.reduce((sum, weight) => sum + weight, 0n);
    // Reported weights below 100 % leave an uncovered share; above 100 % (source rounding) they are scaled down.
    const uncovered = covered < WEIGHT_SCALE ? WEIGHT_SCALE - covered : 0n;
    const shares = apportion(valueMinor, uncovered > 0n ? [...weights, uncovered] : weights);
    keys.forEach((key, index) => add(key, "classified", holding.instrumentId, shares[index]));
    if (uncovered > 0n) {
      unclassified.push({ instrumentId: holding.instrumentId, coverage: "partial" });
      add(UNKNOWN_EXPOSURE, "unknown", holding.instrumentId, shares[keys.length]);
    }
  }
  add(CASH_EXPOSURE, "cash", CASH_EXPOSURE, cashMinor);

  const totalMinor = holdings.reduce((sum, holding) => sum + holding.marketValueMinor!, cashMinor);
  const rows = [...categories.values()].map((category) => ({
    ...category,
    weightBasisPoints: allocationBasisPoints(category.valueMinor, totalMinor),
    contributions: category.contributions.sort((a, b) => (b.valueMinor > a.valueMinor ? 1 : b.valueMinor < a.valueMinor ? -1 : a.instrumentId.localeCompare(b.instrumentId))),
  })).sort(byValue);
  return { status: "valued", totalMinor, categories: rows, unclassified };
}
