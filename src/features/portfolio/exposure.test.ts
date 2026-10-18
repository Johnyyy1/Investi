import { describe, expect, it } from "vitest";
import { weightUnitsFromFraction, WEIGHT_SCALE } from "./decimal";
import { apportion, exposureKey, portfolioExposure, type ExposureHoldingInput, type PortfolioExposure } from "./exposure";

const weights = (dimension: "sector" | "country", rows: ReadonlyArray<readonly [string, number]>) =>
  rows.map(([name, weight]) => ({ key: exposureKey(dimension, name), weightUnits: weightUnitsFromFraction(weight) }));
const whole = (dimension: "sector" | "country", name: string) => [{ key: exposureKey(dimension, name), weightUnits: WEIGHT_SCALE }];

function valued(exposure: PortfolioExposure) {
  if (exposure.status !== "valued") throw new Error("expected a valued exposure");
  const total = exposure.categories.reduce((sum, category) => sum + category.valueMinor, 0n);
  expect(total, "categories add up exactly to the portfolio total").toBe(exposure.totalMinor);
  for (const category of exposure.categories) {
    expect(category.contributions.reduce((sum, contribution) => sum + contribution.valueMinor, 0n)).toBe(category.valueMinor);
  }
  return exposure;
}
const row = (exposure: PortfolioExposure, key: string) => valued(exposure).categories.find((category) => category.key === key);

// The deterministic VWCE sample: sectors sum to 100 %, the ten reported countries to 86.8 %.
const vwceSectors = weights("sector", [["Technology", .252], ["Financials", .158], ["Industrials", .132], ["Healthcare", .117], ["Consumer goods", .104], ["Communication", .077], ["Energy", .064], ["Materials", .041], ["Utilities", .032], ["Real estate", .023]]);
const vwceCountries = weights("country", [["United States", .581], ["Japan", .071], ["United Kingdom", .044], ["China", .038], ["Canada", .031], ["France", .027], ["Germany", .023], ["Switzerland", .019], ["India", .018], ["Taiwan", .016]]);

describe("apportionment", () => {
  it("always sums to the total and gives leftover units to the largest remainders", () => {
    expect(apportion(100n, [1n, 1n, 1n])).toEqual([34n, 33n, 33n]);
    expect(apportion(10n, [1n, 3n])).toEqual([3n, 7n]);
    expect(apportion(0n, [5n, 5n])).toEqual([0n, 0n]);
    for (const total of [1n, 7n, 13_333n, 999_999n]) {
      expect(apportion(total, [100_000n, 250_000n, 13_333n, 636_667n]).reduce((sum, value) => sum + value, 0n)).toBe(total);
    }
  });

  it("refuses negative or empty inputs", () => {
    expect(() => apportion(-1n, [1n])).toThrow(RangeError);
    expect(() => apportion(1n, [0n, 0n])).toThrow(RangeError);
    expect(() => apportion(1n, [-1n, 2n])).toThrow(RangeError);
  });
});

describe("classification keys", () => {
  it("meets an equity's ISO code and a fund's country name on one key", () => {
    expect(exposureKey("country", "US")).toBe("US");
    expect(exposureKey("country", "United States")).toBe("US");
    expect(exposureKey("country", " united  kingdom ")).toBe("GB");
    expect(exposureKey("country", "Atlantis")).toBe("Atlantis");
    expect(exposureKey("sector", " Technology ")).toBe("Technology");
  });
});

describe("portfolio exposure", () => {
  it("AAPL + VWCE: the stock goes whole into its sector and country, the ETF is looked through", () => {
    const holdings: ExposureHoldingInput[] = [
      { instrumentId: "US-XNAS:AAPL", marketValueMinor: 64_838n, breakdown: whole("sector", "Technology") },
      { instrumentId: "IE-XETR:VWCE", marketValueMinor: 61_752n, breakdown: vwceSectors },
    ];
    const sectors = valued(portfolioExposure(73_410n, holdings));
    expect(sectors.totalMinor).toBe(200_000n);
    // 61 752 × 25.2 % = 15 561.5 → apportioned, so Technology = 64 838 + 15 561 or 15 562.
    const technology = row(sectors, "Technology")!;
    expect(technology.contributions.map(({ instrumentId }) => instrumentId)).toEqual(["US-XNAS:AAPL", "IE-XETR:VWCE"]);
    expect(technology.valueMinor - 64_838n).toBeGreaterThanOrEqual(15_561n);
    expect(technology.valueMinor - 64_838n).toBeLessThanOrEqual(15_562n);
    expect(sectors.categories[0].key).toBe("Technology");
    expect(sectors.categories.at(-1)).toMatchObject({ kind: "cash", valueMinor: 73_410n, weightBasisPoints: 3_671n });
    expect(sectors.unclassified).toEqual([]);
    expect(row(sectors, "unknown")).toBeUndefined();

    const countries = valued(portfolioExposure(73_410n, [
      { ...holdings[0], breakdown: whole("country", "US") },
      { ...holdings[1], breakdown: vwceCountries },
    ]));
    expect(row(countries, "US")!.contributions.map(({ instrumentId }) => instrumentId)).toEqual(["US-XNAS:AAPL", "IE-XETR:VWCE"]);
    // Only 86.8 % of VWCE's countries are reported: the other 13.2 % is shown as unknown, not dropped.
    const vwceClassified = countries.categories.filter(({ kind }) => kind === "classified").flatMap(({ contributions }) => contributions)
      .filter(({ instrumentId }) => instrumentId === "IE-XETR:VWCE").reduce((sum, contribution) => sum + contribution.valueMinor, 0n);
    expect(row(countries, "unknown")).toMatchObject({ kind: "unknown", valueMinor: 61_752n - vwceClassified });
    expect(61_752n - vwceClassified).toBeGreaterThanOrEqual(8_151n); // 13.2 % of 617.52 Kč
    expect(61_752n - vwceClassified).toBeLessThanOrEqual(8_152n);
    expect(countries.unclassified).toEqual([{ instrumentId: "IE-XETR:VWCE", coverage: "partial" }]);
  });

  it("cash only is one cash category at 100 %", () => {
    const exposure = valued(portfolioExposure(500_000n, []));
    expect(exposure.categories).toEqual([{ key: "cash", kind: "cash", valueMinor: 500_000n, weightBasisPoints: 10_000n, contributions: [{ instrumentId: "cash", valueMinor: 500_000n }] }]);
  });

  it("an ETF without a breakdown goes whole into unknown and is named as unclassified", () => {
    const exposure = valued(portfolioExposure(100_000n, [{ instrumentId: "FMP:ARCA:VT", marketValueMinor: 300_000n, breakdown: null }]));
    expect(row(exposure, "unknown")).toMatchObject({ valueMinor: 300_000n, weightBasisPoints: 7_500n });
    expect(exposure.unclassified).toEqual([{ instrumentId: "FMP:ARCA:VT", coverage: "none" }]);
    expect(valued(portfolioExposure(0n, [{ instrumentId: "X", marketValueMinor: 1n, breakdown: [] }])).categories).toMatchObject([{ kind: "unknown", valueMinor: 1n }]);
  });

  it("a missing quote or FX makes the whole exposure unvalued instead of counting it as zero", () => {
    expect(portfolioExposure(100_000n, [
      { instrumentId: "US-XNAS:AAPL", marketValueMinor: 50_000n, breakdown: whole("sector", "Technology") },
      { instrumentId: "FMP:NASDAQ:NVDA", marketValueMinor: null, breakdown: whole("sector", "Technology") },
    ])).toEqual({ status: "unvalued", missingInstrumentIds: ["FMP:NASDAQ:NVDA"] });
  });

  it.each([
    ["0.1 / 0.25 / 0.013333", [["A", .1], ["B", .25], ["C", .013333]], 13_333n],
    ["weights that add up to exactly 1", [["A", .1], ["B", .25], ["C", .65]], 1n],
    ["weights that overshoot 1 through source rounding", [["A", .3334], ["B", .3333], ["C", .3334]], 99_999n],
  ] as const)("decimal weights stay exact: %s", (_, rows, value) => {
    const exposure = valued(portfolioExposure(7n, [{ instrumentId: "FUND", marketValueMinor: value, breakdown: weights("sector", rows) }]));
    const covered = rows.reduce((sum, [, weight]) => sum + weightUnitsFromFraction(weight), 0n);
    expect(row(exposure, "unknown")?.valueMinor ?? 0n).toBe(covered < WEIGHT_SCALE ? value - ["A", "B", "C"].reduce((sum, key) => sum + (row(exposure, key)?.valueMinor ?? 0n), 0n) : 0n);
    for (const key of ["A", "B", "C"]) {
      const weight = weightUnitsFromFraction(rows.find(([name]) => name === key)![1]);
      const denominator = covered > WEIGHT_SCALE ? covered : WEIGHT_SCALE;
      const share = row(exposure, key)?.valueMinor ?? 0n;
      expect(share * denominator - value * weight).toBeLessThan(denominator);
      expect(value * weight - share * denominator).toBeLessThan(denominator);
    }
  });

  it("merges repeated keys and orders classified categories by value, then unknown, then cash", () => {
    const exposure = valued(portfolioExposure(10n, [
      { instrumentId: "A", marketValueMinor: 40n, breakdown: whole("country", "US") },
      { instrumentId: "B", marketValueMinor: 60n, breakdown: weights("country", [["Japan", .5], ["United States", .25], ["US", .25]]) },
      { instrumentId: "C", marketValueMinor: 5n, breakdown: null },
    ]));
    expect(exposure.categories.map(({ key, valueMinor }) => [key, valueMinor])).toEqual([["US", 70n], ["JP", 30n], ["unknown", 5n], ["cash", 10n]]);
    expect(row(exposure, "US")!.contributions).toEqual([{ instrumentId: "A", valueMinor: 40n }, { instrumentId: "B", valueMinor: 30n }]);
  });

  it("rejects weights outside 0–1 at the conversion boundary", () => {
    expect(() => weightUnitsFromFraction(1.2)).toThrow(RangeError);
    expect(() => weightUnitsFromFraction(-0.1)).toThrow(RangeError);
    expect(weightUnitsFromFraction(0.0133333)).toBe(13_333n);
  });
});
