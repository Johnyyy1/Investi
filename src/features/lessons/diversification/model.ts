import { allocationBasisPoints } from "@/features/portfolio/domain";
import { portfolioExposure, type ExposureCategory, type ExposureWeight } from "@/features/portfolio/exposure";

/**
 * Lesson-side arithmetic for the Diversification module. Weights, sector and country splits and
 * the ETF look-through go through Portfolio Lab's own functions (integer minor units, basis
 * points, largest-remainder apportioning), so a lesson percentage and a Lab percentage round the
 * same way. Every instrument here is invented: names, holdings and scenario returns are not
 * market data and recommend nothing.
 */
export type ExposureView = "company" | "sector" | "country";

/** Kč → minor units; lesson amounts are whole crowns. */
const minor = (crowns: number) => BigInt(Math.round(crowns * 100));
/** Percent of an instrument (0–100, at most 4 dp) → parts per million (WEIGHT_SCALE). */
const weightUnits = (percent: number) => BigInt(Math.round(percent * 10_000));
const breakdown = (shares: Record<string, number>): ExposureWeight[] => Object.entries(shares).map(([key, percent]) => ({ key, weightUnits: weightUnits(percent) }));

/** Basis points → percent for display and answers; the rounding already happened in allocationBasisPoints. */
export const basisPointsToPercent = (basisPoints: bigint) => Number(basisPoints) / 100;

export function positionWeights(positions: readonly { id: string; value: number }[]) {
  const total = positions.reduce((sum, position) => sum + minor(position.value), 0n);
  const rows = positions.map((position) => ({ ...position, weightBasisPoints: allocationBasisPoints(minor(position.value), total) }));
  const largest = rows.reduce<(typeof rows)[number] | null>((best, row) => !best || row.weightBasisPoints > best.weightBasisPoints ? row : best, null);
  return { totalCrowns: Number(total) / 100, rows, largest };
}

/** The portfolio's change if one position moves by `positionReturn` and the rest stand still. */
export function singlePositionImpact(weightPercent: number, positionReturn: number) {
  return weightPercent / 100 * positionReturn;
}

/** Five invented holdings for the concentration explorer, in Kč. */
export const concentrationSample = [
  { id: "a", label: "Firma A", value: 40_000 },
  { id: "b", label: "Firma B", value: 15_000 },
  { id: "c", label: "Firma C", value: 15_000 },
  { id: "d", label: "Firma D", value: 15_000 },
  { id: "e", label: "Firma E", value: 15_000 },
] as const;

/** The teaching threshold for one direct position; a stated rule of thumb for these exercises, not a recommendation. */
export const MAX_POSITION_PERCENT = 25;

type Classification = Record<ExposureView, Record<string, number>>;
export type LessonInstrument = { id: string; label: string; kind: "stock" | "etf"; description: string; classification: Classification };

const stock = (id: string, label: string, sector: string, country: string): LessonInstrument => ({
  id, label, kind: "stock", description: `Akcie jedné firmy · ${sector} · ${country}`,
  classification: { company: { [label.replace("Akcie ", "")]: 100 }, sector: { [sector]: 100 }, country: { [country]: 100 } },
});

/** Remainders of many small holdings, sectors or countries; none of them ever counts as one category. */
const OTHER_COMPANIES = "Ostatní firmy", OTHER_SECTORS = "Ostatní sektory", OTHER_COUNTRIES = "Ostatní země";
const remainderBuckets: ReadonlySet<string> = new Set([OTHER_COMPANIES, OTHER_SECTORS, OTHER_COUNTRIES]);

/** Six invented instruments shared by the look-through explorer and the scenario. */
export const lessonInstruments = {
  svet: {
    id: "svet", label: "Fond Svět", kind: "etf", description: "ETF · asi 1 500 firem z mnoha zemí",
    classification: {
      company: { "Čip": 4, "Software": 3, "Banka": 1, [OTHER_COMPANIES]: 92 },
      sector: { "Technologie": 25, "Finance": 15, "Spotřeba": 18, "Zdravotnictví": 12, "Průmysl": 12, "Energie": 6, [OTHER_SECTORS]: 12 },
      country: { "USA": 62, "Japonsko": 6, "Velká Británie": 4, "Německo": 3, "Francie": 3, "Švýcarsko": 3, [OTHER_COUNTRIES]: 19 },
    },
  },
  tech: {
    id: "tech", label: "Fond Technologie", kind: "etf", description: "ETF · 100 technologických firem",
    classification: {
      company: { "Čip": 12, "Software": 10, [OTHER_COMPANIES]: 78 },
      sector: { "Technologie": 100 },
      country: { "USA": 90, [OTHER_COUNTRIES]: 10 },
    },
  },
  cip: stock("cip", "Akcie Čip", "Technologie", "USA"),
  energie: stock("energie", "Akcie Energie", "Energie", "Velká Británie"),
  banka: stock("banka", "Akcie Banka", "Finance", "Německo"),
  leky: stock("leky", "Akcie Léky", "Zdravotnictví", "Švýcarsko"),
} as const satisfies Record<string, LessonInstrument>;

export type LessonInstrumentId = keyof typeof lessonInstruments;
export const lessonInstrumentIds = Object.keys(lessonInstruments) as LessonInstrumentId[];

export type ExposureRow = { key: string; kind: ExposureCategory["kind"]; percent: number; contributions: { instrumentId: string; percent: number }[] };

/**
 * Look-through exposure of a portfolio given as percent of the whole (cash is the rest), by the
 * same function Portfolio Lab uses. A stock goes whole into its company, sector and country; an
 * ETF is split by its reported weights.
 */
export function lookThrough(allocation: Partial<Record<string, number>>, view: ExposureView, instruments: Record<string, LessonInstrument> = lessonInstruments, totalCrowns = 100_000) {
  const invested = Object.values(allocation).reduce<number>((sum, percent) => sum + (percent ?? 0), 0);
  if (invested > 100 + 1e-9) throw new RangeError("The allocation cannot exceed 100 %.");
  const holdings = Object.entries(allocation).filter(([, percent]) => (percent ?? 0) > 0).map(([id, percent]) => {
    const instrument = instruments[id];
    if (!instrument) throw new RangeError(`Unknown lesson instrument: ${id}`);
    return { instrumentId: id, marketValueMinor: minor(totalCrowns * percent! / 100), breakdown: breakdown(instrument.classification[view]) };
  });
  const cashMinor = minor(totalCrowns) - holdings.reduce((sum, holding) => sum + holding.marketValueMinor, 0n);
  const exposure = portfolioExposure(cashMinor, holdings);
  if (exposure.status !== "valued") throw new Error("Lesson portfolios are always valued.");
  return exposure.categories.map((category): ExposureRow => ({
    key: category.key, kind: category.kind, percent: basisPointsToPercent(category.weightBasisPoints),
    contributions: category.contributions.map((contribution) => ({ instrumentId: contribution.instrumentId, percent: basisPointsToPercent(allocationBasisPoints(contribution.valueMinor, exposure.totalMinor)) })),
  }));
}

/** The largest classified category; a remainder bucket or the cash never counts as one. */
export function largestExposure(rows: readonly ExposureRow[]) {
  return rows.find((row) => row.kind === "classified" && !remainderBuckets.has(row.key)) ?? null;
}

/** Two invented portfolios of five direct stocks plus cash for the sector and country explorer. */
export const exposureSamples = {
  tech: {
    label: "Pět technologických firem",
    instruments: {
      a: stock("a", "Akcie Čip", "Technologie", "USA"),
      b: stock("b", "Akcie Software", "Technologie", "USA"),
      c: stock("c", "Akcie Cloud", "Technologie", "USA"),
      d: stock("d", "Akcie Telefon", "Technologie", "USA"),
      e: stock("e", "Akcie Síť", "Technologie", "Irsko"),
    },
    allocation: { a: 18, b: 18, c: 18, d: 18, e: 18 },
  },
  mix: {
    label: "Pět různých odvětví",
    instruments: {
      a: stock("a", "Akcie Čip", "Technologie", "USA"),
      b: stock("b", "Akcie Banka", "Finance", "Německo"),
      c: stock("c", "Akcie Léky", "Zdravotnictví", "Švýcarsko"),
      d: stock("d", "Akcie Energie", "Energie", "Velká Británie"),
      e: stock("e", "Akcie Potraviny", "Spotřeba", "Japonsko"),
    },
    allocation: { a: 18, b: 18, c: 18, d: 18, e: 18 },
  },
} as const;

/** Preset portfolios for the ETF look-through explorer, in percent of the whole. */
export const lookThroughPresets = {
  overlap: { label: "Dva fondy a Čip", allocation: { svet: 50, tech: 30, cip: 20 } },
  world: { label: "Jen Fond Svět", allocation: { svet: 100 } },
  tech: { label: "Jen Fond Technologie", allocation: { tech: 100 } },
} as const;

/**
 * Volatility of a two-asset portfolio from both volatilities, the weight of A and the correlation:
 * σp = √(w²σA² + (1 − w)²σB² + 2w(1 − w)ρσAσB). Decimal in, decimal out.
 */
export function twoAssetVolatility(weightFirst: number, volatilityFirst: number, volatilitySecond: number, correlation: number) {
  if (!(weightFirst >= 0 && weightFirst <= 1)) throw new RangeError("The weight must lie between 0 and 1.");
  if (!(correlation >= -1 && correlation <= 1)) throw new RangeError("The correlation must lie between −1 and 1.");
  if (!(volatilityFirst >= 0 && volatilitySecond >= 0)) throw new RangeError("Volatility cannot be negative.");
  const weightSecond = 1 - weightFirst;
  const variance = weightFirst ** 2 * volatilityFirst ** 2 + weightSecond ** 2 * volatilitySecond ** 2 + 2 * weightFirst * weightSecond * correlation * volatilityFirst * volatilitySecond;
  return Math.sqrt(Math.max(0, variance));
}

/** Explicit, explainable thresholds for the scenario. They describe spread, not the outcome. */
export const scenarioRules = [
  { id: "company", view: "company", label: "Největší jednotlivá firma", maxPercent: 10, why: "Problém jedné firmy pak nezasáhne víc než desetinu portfolia." },
  { id: "sector", view: "sector", label: "Největší sektor", maxPercent: 40, why: "Firmy jednoho odvětví často padají společně, třeba při změně regulace." },
  { id: "country", view: "country", label: "Největší země", maxPercent: 70, why: "Jedna ekonomika, měna a politika nemá rozhodovat skoro o všem." },
  { id: "cash", view: "cash", label: "Hotovost", maxPercent: 20, why: "Scénář je o rozložení investic. Hotovost riziko nerozkládá, jen ho odkládá." },
] as const satisfies readonly { id: string; view: ExposureView | "cash"; label: string; maxPercent: number; why: string }[];

/** Two invented one-year sector moves. In the scenario every company moves with its sector. */
export const scenarioOutcomes = {
  crash: { label: "Technologický propad", sectors: { "Technologie": -0.3, "Finance": -0.05, "Spotřeba": -0.05, "Zdravotnictví": 0.05, "Průmysl": -0.05, "Energie": 0.15, [OTHER_SECTORS]: -0.05 } },
  boom: { label: "Technologický boom", sectors: { "Technologie": 0.35, "Finance": 0.05, "Spotřeba": 0.05, "Zdravotnictví": 0, "Průmysl": 0.05, "Energie": -0.1, [OTHER_SECTORS]: 0.05 } },
} as const satisfies Record<string, { label: string; sectors: Record<string, number> }>;

export type ScenarioAllocation = Partial<Record<LessonInstrumentId, number>>;

/** Rule results and both outcomes for a locked scenario portfolio; cash returns 0 %. */
export function evaluateScenario(allocation: ScenarioAllocation) {
  const sectors = lookThrough(allocation, "sector");
  const rules = scenarioRules.map((rule) => {
    const largest = rule.view === "cash" ? sectors.find((row) => row.kind === "cash") ?? null : largestExposure(lookThrough(allocation, rule.view));
    const percent = largest?.percent ?? 0;
    return { ...rule, largest: rule.view === "cash" ? null : largest?.key ?? null, percent, pass: percent <= rule.maxPercent };
  });
  const outcomes = (Object.keys(scenarioOutcomes) as (keyof typeof scenarioOutcomes)[]).map((id) => {
    const moves: Record<string, number> = scenarioOutcomes[id].sectors;
    const portfolioReturn = sectors.reduce((sum, row) => sum + (row.kind === "classified" ? row.percent / 100 * moves[row.key] : 0), 0);
    return { id, label: scenarioOutcomes[id].label, portfolioReturn };
  });
  return { rules, passed: rules.every((rule) => rule.pass), outcomes };
}
