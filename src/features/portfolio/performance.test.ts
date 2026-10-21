import { describe, expect, it } from "vitest";
import { generationContributions, moneyWeightedReturn, timeWeightedReturn } from "./performance";

const start = "2023-01-01T00:00:00.000Z";
const middle = "2024-01-01T00:00:00.000Z";
const end = "2024-12-31T00:00:00.000Z"; // two ACT/365 years

describe("generation performance", () => {
  it("reproduces lesson 3.1.6: TWR +8% over two years, MWR about -6.0523% per year", () => {
    const twr = timeWeightedReturn(1_000_000n, [
      { amountMinor: 5_000_000n, valueBeforeMinor: 1_200_000n },
    ], 5_580_000n, 730);
    expect(twr).toEqual({ status: "available", basisPoints: "800", annualizedBasisPoints: "392" });
    expect(moneyWeightedReturn([
      { at: start, amountMinor: 1_000_000n }, { at: middle, amountMinor: 5_000_000n },
    ], end, 5_580_000n)).toEqual({ status: "available", basisPoints: "-1174", annualizedBasisPoints: "-605" });
  });

  it("without intermediate contributions, TWR equals MWR, including cash and costs", () => {
    for (const final of [0n, 999_999n, 1_000_000n, 1_080_000n, 9_000_000n]) {
      expect(moneyWeightedReturn([{ at: start, amountMinor: 1_000_000n }], end, final))
        .toEqual(timeWeightedReturn(1_000_000n, [], final, 730));
    }
  });

  it("a new contribution at the end cannot dilute TWR", () => {
    expect(timeWeightedReturn(500_000n, [], 510_000n, 30)).toEqual(
      timeWeightedReturn(500_000n, [{ amountMinor: 200_000n, valueBeforeMinor: 510_000n }], 710_000n, 30),
    );
    expect(timeWeightedReturn(500_000n, [], 510_000n, 30)).toEqual({ status: "available", basisPoints: "200", annualizedBasisPoints: null });
  });

  it("does not annualize a period shorter than 365 days, even with irregular dated flows", () => {
    const result = moneyWeightedReturn([{ at: start, amountMinor: 100n }, { at: "2023-01-16T12:00:00.000Z", amountMinor: 100n }], "2023-02-01T00:00:00.000Z", 231n);
    expect(result).toEqual({ status: "available", basisPoints: "2100", annualizedBasisPoints: null });
  });

  it("keeps huge money exact and rounds positive, negative and halfway basis points centrally", () => {
    for (const [value, basisPoints] of [[20_001n, "1"], [19_999n, "-1"], [20_003n, "2"], [19_997n, "-2"]]) {
      expect(timeWeightedReturn(20_000n, [], value as bigint, 1)).toMatchObject({ basisPoints });
      expect(moneyWeightedReturn([{ at: start, amountMinor: 20_000n }, { at: end, amountMinor: 100n }], end, (value as bigint) + 100n)).toMatchObject({ basisPoints });
    }
    const huge = 10n ** 25n;
    expect(timeWeightedReturn(huge, [], huge * 108n / 100n, 730)).toEqual(moneyWeightedReturn([{ at: start, amountMinor: huge }], end, huge * 108n / 100n));
  });

  it("does not misrepresent a positive value below numerical resolution as a total loss", () => {
    expect(moneyWeightedReturn([{ at: start, amountMinor: 10n ** 25n }], end, 1n)).toEqual({ status: "unavailable", reason: "no-solution" });
    expect(timeWeightedReturn(10n ** 25n, [], 1n, 730)).toEqual({ status: "unavailable", reason: "no-solution" });
  });

  it("never replaces missing boundary valuations with zero and lets MWR work independently", () => {
    expect(timeWeightedReturn(100n, [{ amountMinor: 100n, valueBeforeMinor: null }], 220n, 730)).toEqual({ status: "unavailable", reason: "missing-valuation" });
    expect(moneyWeightedReturn([{ at: start, amountMinor: 100n }], end, null)).toEqual({ status: "unavailable", reason: "missing-valuation" });
    expect(timeWeightedReturn(100n, [], 0n, 30)).toMatchObject({ basisPoints: "-10000" });
  });

  it("handles undefined returns and unresolvable or unsupported cash flows", () => {
    expect(moneyWeightedReturn([], end, 0n)).toMatchObject({ status: "unavailable" });
    expect(moneyWeightedReturn([{ at: end, amountMinor: 100n }], end, 100n)).toMatchObject({ reason: "no-period" });
    expect(moneyWeightedReturn([{ at: start, amountMinor: -100n }], end, 100n)).toMatchObject({ reason: "invalid-ledger" });
    expect(moneyWeightedReturn([{ at: start, amountMinor: 100n }, { at: end, amountMinor: 100n }], end, 50n)).toMatchObject({ reason: "no-solution" });
    expect(timeWeightedReturn(100n, [{ amountMinor: 100n, valueBeforeMinor: 0n }], 100n, 30)).toMatchObject({ reason: "zero-boundary" });
  });

  it("reset starts a new series with all existing entitlement and ignores old receipt dates", () => {
    const receipts = [{ at: start, amountMinor: 500_000n }, { at: middle, amountMinor: 200_000n }, { at: end, amountMinor: 200_000n }];
    expect(generationContributions(middle, 700_000n, receipts)).toEqual([
      { at: middle, amountMinor: 700_000n }, { at: end, amountMinor: 200_000n },
    ]);
    expect(generationContributions(start, 0n, [{ at: end, amountMinor: 0n }, { at: middle, amountMinor: 100n }, { at: middle, amountMinor: 200n }]))
      .toEqual([{ at: middle, amountMinor: 300n }]);
  });

  it("groups a new receipt at the same millisecond as generation opening without losing it", () => {
    expect(generationContributions(start, 500n, [{ at: "2022-12-01T00:00:00.000Z", amountMinor: 500n }, { at: start, amountMinor: 200n }])).toEqual([{ at: start, amountMinor: 700n }]);
  });
});
