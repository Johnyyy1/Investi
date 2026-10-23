import { describe, expect, it } from "vitest";
import { lessonLink } from "@/features/learning/catalog";
import { exampleIps } from "@/features/ips/test-fixtures";
import {
  DECISION_CARD_COOLDOWN_MS, DECISION_CARDS, backtestDecisionCards, pickDecisionCard, readDecisionCardPreferences, tradeDecisionCards,
  type DecisionCardKind, type TradeCardInput,
} from "./decision-cards";

const now = new Date("2026-10-23T12:00:00.000Z");
const daysAgo = (days: number) => ({ executedAt: new Date(now.getTime() - days * 24 * 60 * 60 * 1000) });
const base: TradeCardInput = { side: "BUY", instrumentId: "US-XNAS:AAPL", now, trades: [], holdings: [], ips: null };
const instrumentPlan = { ...exampleIps, allocation: { lines: [{ instrumentId: "US-ARCX:SPY", weightBps: 9000 }], cashBps: 1000 } };
const classPlan = { ...exampleIps, allocation: { lines: [{ assetClass: "equity", weightBps: 9000 }], cashBps: 1000 } };

describe("trade decision cards", () => {
  it("flags a buy outside an instrument-level plan, never without a usable plan", () => {
    expect(tradeDecisionCards({ ...base, ips: instrumentPlan })).toEqual(["outside-ips"]);
    expect(tradeDecisionCards({ ...base, instrumentId: "US-ARCX:SPY", ips: instrumentPlan })).toEqual([]);
    expect(tradeDecisionCards({ ...base, side: "SELL", ips: instrumentPlan })).toEqual([]);
    expect(tradeDecisionCards({ ...base, ips: classPlan })).toEqual([]);
    expect(tradeDecisionCards({ ...base, ips: { legacy: true } })).toEqual([]);
  });

  it("flags selling a winner only while another valued holding is at a loss", () => {
    const sell = { ...base, side: "SELL" as const };
    const winner = { instrumentId: "US-XNAS:AAPL", gainLossMinor: 1n };
    expect(tradeDecisionCards({ ...sell, holdings: [winner, { instrumentId: "US-ARCX:SPY", gainLossMinor: -1n }] })).toEqual(["disposition"]);
    expect(tradeDecisionCards({ ...sell, holdings: [winner, { instrumentId: "US-ARCX:SPY", gainLossMinor: 0n }] })).toEqual([]);
    expect(tradeDecisionCards({ ...sell, holdings: [winner, { instrumentId: "US-ARCX:SPY", gainLossMinor: null }] })).toEqual([]);
    expect(tradeDecisionCards({ ...sell, holdings: [{ ...winner, gainLossMinor: null }, { instrumentId: "US-ARCX:SPY", gainLossMinor: -1n }] })).toEqual([]);
    expect(tradeDecisionCards({ ...sell, holdings: [{ ...winner, gainLossMinor: -1n }, { instrumentId: "US-ARCX:SPY", gainLossMinor: -1n }] })).toEqual([]);
  });

  it("flags the fifth trade within a rolling seven days", () => {
    expect(tradeDecisionCards({ ...base, trades: [daysAgo(0), daysAgo(1), daysAgo(3), daysAgo(6.9)] })).toEqual(["turnover"]);
    expect(tradeDecisionCards({ ...base, trades: [daysAgo(0), daysAgo(1), daysAgo(3), daysAgo(7)] })).toEqual([]);
    expect(tradeDecisionCards({ ...base, trades: [daysAgo(0), daysAgo(1), daysAgo(3)] })).toEqual([]);
  });

  it("lists applicable cards in priority order", () => {
    expect(tradeDecisionCards({ ...base, ips: instrumentPlan, trades: [daysAgo(0), daysAgo(0), daysAgo(0), daysAgo(0)] })).toEqual(["outside-ips", "turnover"]);
  });
});

describe("backtest and picking", () => {
  it("flags the fifth distinct backtest attempt for one goal", () => {
    expect(backtestDecisionCards(4)).toEqual([]);
    expect(backtestDecisionCards(5)).toEqual(["overfitting"]);
  });

  it("shows at most one card, skipping turned-off kinds and those inside the cooldown", () => {
    const at = now.getTime();
    const candidates: DecisionCardKind[] = ["outside-ips", "turnover"];
    expect(pickDecisionCard(candidates, { disabled: [], shownAt: {} }, at)).toBe("outside-ips");
    expect(pickDecisionCard(candidates, { disabled: ["outside-ips"], shownAt: {} }, at)).toBe("turnover");
    expect(pickDecisionCard(candidates, { disabled: [], shownAt: { "outside-ips": at - DECISION_CARD_COOLDOWN_MS + 1 } }, at)).toBe("turnover");
    expect(pickDecisionCard(candidates, { disabled: [], shownAt: { "outside-ips": at - DECISION_CARD_COOLDOWN_MS } }, at)).toBe("outside-ips");
    expect(pickDecisionCard(candidates, { disabled: ["turnover"], shownAt: { "outside-ips": at } }, at)).toBeNull();
  });

  it("reads stored preferences defensively", () => {
    expect(readDecisionCardPreferences(null)).toEqual({ disabled: [], shownAt: {} });
    expect(readDecisionCardPreferences("not json")).toEqual({ disabled: [], shownAt: {} });
    expect(readDecisionCardPreferences(JSON.stringify({ disabled: ["turnover", "unknown"], shownAt: { turnover: 5, other: 1, disposition: "x" } })))
      .toEqual({ disabled: ["turnover"], shownAt: { turnover: 5 } });
  });

  it("links every card to a published lesson", () => {
    for (const card of Object.values(DECISION_CARDS)) expect(lessonLink(card.lessonId)).not.toBeNull();
  });
});
