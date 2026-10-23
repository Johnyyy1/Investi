import { describe, expect, it } from "vitest";

import type { Instrument } from "./contracts";
import {
  evaluateQuoteUsability,
  getMarketSessionSnapshot,
  isUsEquitiesTradingDay,
  marketCalendarForInstrument,
  nextUsEquitiesSessionOpen,
  usEquitiesHolidays,
} from "./market-session";

const policy = { freshForMilliseconds: 15 * 60 * 1_000, unavailableAfterMilliseconds: 24 * 60 * 60 * 1_000 };

function equity(exchangeMic: string | null): Instrument {
  return { instrumentId: `TEST:${exchangeMic ?? "UNKNOWN"}:AAPL`, symbol: "AAPL", name: "Apple", assetType: "equity", exchangeMic, quoteCurrency: "USD" };
}

const xnas = equity("XNAS");

describe("U.S. equities market calendar", () => {
  it("associates XNAS, XNYS, and XASE equities with the U.S. calendar only", () => {
    expect(["XNAS", "XNYS", "XASE"].map((mic) => marketCalendarForInstrument(equity(mic)))).toEqual([
      "us-equities",
      "us-equities",
      "us-equities",
    ]);
    expect(marketCalendarForInstrument(equity("XETR"))).toBeNull();
    expect(marketCalendarForInstrument({ ...equity("XNAS"), assetType: "bond" })).toBeNull();
  });

  it.each([
    ["Friday before open", "2026-06-12T13:29:00.000Z", "closed"],
    ["Friday during regular session", "2026-06-12T13:30:00.000Z", "open"],
    ["Friday shortly after close", "2026-06-12T20:01:00.000Z", "closed"],
    ["Saturday", "2026-06-13T16:00:00.000Z", "closed"],
    ["Sunday", "2026-06-14T16:00:00.000Z", "closed"],
    ["Monday before open", "2026-06-15T13:29:00.000Z", "closed"],
    ["Monday during regular session", "2026-06-15T13:30:00.000Z", "open"],
    ["Monday after close", "2026-06-15T20:01:00.000Z", "closed"],
  ])("classifies %s", (_label, instant, expected) => {
    expect(getMarketSessionSnapshot(xnas, new Date(instant)).state).toBe(expected);
  });

  it("uses America/New_York DST rather than a fixed UTC offset", () => {
    expect(getMarketSessionSnapshot(xnas, new Date("2026-03-06T14:30:00.000Z")).state).toBe("open");
    expect(getMarketSessionSnapshot(xnas, new Date("2026-03-09T13:30:00.000Z")).state).toBe("open");
    expect(getMarketSessionSnapshot(xnas, new Date("2026-03-09T12:30:00.000Z")).state).toBe("closed");
  });

  it("covers recurring full-day holidays and observed dates", () => {
    const holidays = usEquitiesHolidays(2026);
    expect(holidays.has("2026-01-01")).toBe(true);
    expect(holidays.has("2026-04-03")).toBe(true);
    expect(holidays.has("2026-06-19")).toBe(true);
    expect(holidays.has("2026-07-03")).toBe(true);
    expect(holidays.has("2026-11-26")).toBe(true);
    expect(isUsEquitiesTradingDay("2026-07-03")).toBe(false);
    expect(getMarketSessionSnapshot(xnas, new Date("2026-11-26T15:00:00.000Z"))).toMatchObject({
      state: "closed",
      latestCompletedSessionDate: "2026-11-25",
    });
  });

  it("does not invent a Friday observation for a Saturday New Year's Day", () => {
    expect(usEquitiesHolidays(2022).has("2021-12-31")).toBe(false);
    expect(isUsEquitiesTradingDay("2021-12-31")).toBe(true);
  });

  it("recognizes the first regular session after an observed holiday", () => {
    expect(getMarketSessionSnapshot(xnas, new Date("2026-07-06T14:00:00.000Z"))).toMatchObject({
      state: "open",
      localDate: "2026-07-06",
      latestCompletedSessionDate: "2026-07-02",
    });
  });
});

describe("next U.S. equities session open", () => {
  it.each([
    ["Thursday evening (EDT)", "2026-10-22T22:10:00.000Z", "2026-10-23T13:30:00.000Z"],
    ["Friday after the close skips the weekend", "2026-06-12T20:30:00.000Z", "2026-06-15T13:30:00.000Z"],
    ["the same morning before the open", "2026-06-15T12:00:00.000Z", "2026-06-15T13:30:00.000Z"],
    ["exactly at the open means the following session", "2026-06-15T13:30:00.000Z", "2026-06-16T13:30:00.000Z"],
    ["Wednesday before Thanksgiving (EST) skips the holiday", "2026-11-25T22:00:00.000Z", "2026-11-27T14:30:00.000Z"],
    ["Friday before Martin Luther King Jr. Day (EST)", "2026-01-16T21:30:00.000Z", "2026-01-20T14:30:00.000Z"],
    ["Friday before the switch to EDT", "2026-03-06T21:30:00.000Z", "2026-03-09T13:30:00.000Z"],
  ])("%s", (_label, now, expected) => {
    expect(nextUsEquitiesSessionOpen(new Date(now)).toISOString()).toBe(expected);
  });
});

describe("quote usability", () => {
  it("allows a fresh observation for valuation and execution during the regular session", () => {
    expect(evaluateQuoteUsability(xnas, "2026-06-12T14:00:00.000Z", new Date("2026-06-12T14:05:00.000Z"), policy)).toMatchObject({
      status: "fresh",
      marketState: "open",
      usableForValuation: true,
      usableForExecution: true,
    });
  });

  it("rejects a stale observation during an open session", () => {
    expect(evaluateQuoteUsability(xnas, "2026-06-12T14:00:00.000Z", new Date("2026-06-12T14:20:00.000Z"), policy)).toMatchObject({
      status: "stale",
      marketState: "open",
      usableForValuation: false,
      usableForExecution: false,
    });
  });

  it.each([
    ["Saturday", "2026-06-13T16:00:00.000Z"],
    ["Sunday", "2026-06-14T16:00:00.000Z"],
    ["Monday before open", "2026-06-15T13:00:00.000Z"],
  ])("uses Friday's completed-session price for %s valuation but never execution", (_label, now) => {
    expect(evaluateQuoteUsability(xnas, "2026-06-12T20:00:02.000Z", new Date(now), policy)).toMatchObject({
      status: "closed-market-reference",
      marketState: "closed",
      usableForValuation: true,
      usableForExecution: false,
    });
  });

  it("marks Friday's quote stale once a newer Monday session should be producing observations", () => {
    expect(evaluateQuoteUsability(xnas, "2026-06-12T20:00:02.000Z", new Date("2026-06-15T14:00:00.000Z"), policy)).toMatchObject({
      status: "stale",
      marketState: "open",
      usableForValuation: false,
      usableForExecution: false,
    });
  });

  it("uses the prior completed session on a holiday, then expires it once the next session opens", () => {
    expect(evaluateQuoteUsability(xnas, "2026-07-02T20:00:02.000Z", new Date("2026-07-03T15:00:00.000Z"), policy)).toMatchObject({
      status: "closed-market-reference",
      marketState: "closed",
      usableForValuation: true,
      usableForExecution: false,
    });
    expect(evaluateQuoteUsability(xnas, "2026-07-02T20:00:02.000Z", new Date("2026-07-06T14:00:00.000Z"), policy)).toMatchObject({
      status: "stale",
      marketState: "open",
      usableForValuation: false,
      usableForExecution: false,
    });
  });

  it("requires a last-session observation near the regular close", () => {
    expect(evaluateQuoteUsability(xnas, "2026-06-12T15:00:00.000Z", new Date("2026-06-13T16:00:00.000Z"), policy)).toMatchObject({
      status: "stale",
      usableForValuation: false,
    });
  });

  it("keeps unknown venues explicit and applies only the conservative age fallback", () => {
    const unknown = equity("XETR");
    expect(evaluateQuoteUsability(unknown, "2026-06-12T14:00:00.000Z", new Date("2026-06-12T14:05:00.000Z"), policy)).toMatchObject({
      status: "fresh", marketState: "unknown", marketCalendar: null, usableForExecution: true,
    });
    expect(evaluateQuoteUsability(unknown, "2026-06-12T14:00:00.000Z", new Date("2026-06-12T15:00:00.000Z"), policy)).toMatchObject({
      status: "stale", usableForValuation: true, usableForExecution: false,
    });
    expect(evaluateQuoteUsability(unknown, "2026-06-12T14:00:00.000Z", new Date("2026-06-13T15:00:01.000Z"), policy)).toMatchObject({
      status: "unavailable", usableForValuation: false, usableForExecution: false,
    });
  });
});
