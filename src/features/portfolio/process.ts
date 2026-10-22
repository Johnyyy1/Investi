import { ipsSchema } from "@/features/ips/schema";
import { roundDivide } from "./decimal";
import type { TradeSide } from "./domain";

export type ProcessStatus = "information" | "within-plan" | "outside-plan" | "unavailable";
export type ProcessReason = "missing-valuation" | "no-capital" | "no-holdings" | "no-ips" | "legacy-ips" | "asset-class-target";
export interface ProcessMetric {
  value: string | null;
  /** Only an explicit learner-defined IPS band. No universal ideal or pass mark. */
  threshold: string | null;
  status: ProcessStatus;
  reason?: ProcessReason;
}
export interface ProcessInput {
  openedAt: string;
  asOf: string;
  cashMinor: bigint;
  totalMinor: bigint | null;
  holdings: readonly { instrumentId: string; symbol: string; marketValueMinor: bigint | null }[];
  /** Complete ordered ledger of the active generation, never recentActivity. */
  trades: readonly { side: TradeSide; executedAt: Date; grossAmountBaseMinor: bigint; feeBaseMinor: bigint; fxMarkupBaseMinor?: bigint | null }[];
  ips: { version: number; payload: unknown } | null;
}
export interface ProcessFeedback {
  period: { startedAt: string; endedAt: string };
  ipsVersion: number | null;
  hhi: ProcessMetric;
  largestPosition: ProcessMetric & { symbol: string | null };
  costs: ProcessMetric & { feesMinor: string; fxMarkupMinor: string };
  turnover: ProcessMetric & { grossMinor: string; tradeCount: number };
  allocation: ProcessMetric & { lines: { key: string; currentBasisPoints: string; targetBasisPoints: string; deviationBasisPoints: string }[] };
  cash: ProcessMetric & { currentBasisPoints: string | null; targetBasisPoints: string | null };
}

const BPS = 10000n;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const absolute = (value: bigint) => value < 0n ? -value : value;
const unavailable = (reason: ProcessReason, threshold: string | null = null): ProcessMetric => ({ value: null, threshold, status: "unavailable", reason });
const information = (value: bigint): ProcessMetric => ({ value: value.toString(), threshold: null, status: "information" });

/** Read-only educational indicators, calculated with exact ledger money and a dated IPS.
 * HHI uses invested positions only; other weights include cash. All ratios are rounded
 * once at the presentation boundary. Band decisions use unrounded numerators. */
export function portfolioProcess(input: ProcessInput): ProcessFeedback {
  const ended = Date.parse(input.asOf);
  const started = Math.max(Date.parse(input.openedAt), ended - YEAR_MS);
  const trades = input.trades.filter(({ executedAt }) => executedAt.getTime() >= started && executedAt.getTime() <= ended);
  const fees = trades.reduce((sum, trade) => sum + trade.feeBaseMinor, 0n);
  // NULL identifies the historical fee-free model; never reprice old trades.
  const fx = trades.reduce((sum, trade) => sum + (trade.fxMarkupBaseMinor ?? 0n), 0n);
  const gross = trades.reduce((sum, trade) => sum + trade.grossAmountBaseMinor, 0n);
  const parsed = ipsSchema.safeParse(input.ips?.payload);
  const plan = parsed.success ? parsed.data : null;
  const band = plan?.rebalancing.mode === "band" ? BigInt(plan.rebalancing.bandBps) : null;
  const threshold = band?.toString() ?? null;
  const invested = input.holdings.reduce((sum, holding) => sum + (holding.marketValueMinor ?? 0n), 0n);
  const total = input.totalMinor;
  const valuationReason = total === null || input.holdings.some(({ marketValueMinor }) => marketValueMinor === null || marketValueMinor < 0n)
    || invested + input.cashMinor !== total ? "missing-valuation" : total <= 0n ? "no-capital" : null;
  const valued = valuationReason === null;
  const weight = (value: bigint) => roundDivide(value * BPS, total!);
  const compare = (numerator: bigint): ProcessMetric => ({
    value: roundDivide(absolute(numerator), total!).toString(), threshold,
    status: band === null ? "information" : absolute(numerator) <= total! * band ? "within-plan" : "outside-plan",
  });
  const largest = input.holdings.reduce<ProcessInput["holdings"][number] | null>((best, holding) =>
    best === null || (holding.marketValueMinor ?? 0n) > (best.marketValueMinor ?? 0n) ? holding : best, null);
  const noPlan: ProcessReason | null = plan ? null : input.ips ? "legacy-ips" : "no-ips";
  const planReason = valuationReason ?? noPlan;
  const cashDeviation = plan && valued ? input.cashMinor * BPS - total! * BigInt(plan.allocation.cashBps) : null;
  const cash: ProcessFeedback["cash"] = {
    ...(planReason ? unavailable(planReason, threshold) : compare(cashDeviation!)),
    // Excess is a share above the target, never a fabricated lost return.
    value: planReason ? null : roundDivide(cashDeviation! > 0n ? cashDeviation! : 0n, total!).toString(),
    currentBasisPoints: valued ? weight(input.cashMinor).toString() : null,
    targetBasisPoints: plan ? plan.allocation.cashBps.toString() : null,
  };
  let allocation: ProcessFeedback["allocation"] = { ...unavailable(planReason ?? "asset-class-target", threshold), lines: [] };
  if (!planReason && plan && plan.allocation.lines.every((line) => "instrumentId" in line)) {
    const targets = new Map(plan.allocation.lines.map((line) => ["instrumentId" in line ? line.instrumentId : "", BigInt(line.weightBps)]));
    const values = new Map(input.holdings.map((holding) => [holding.instrumentId, holding.marketValueMinor!]));
    const keys = [...new Set([...targets.keys(), ...values.keys()])].sort();
    const numerators = [...keys.map((key) => (values.get(key) ?? 0n) * BPS - total! * (targets.get(key) ?? 0n)), cashDeviation!];
    allocation = {
      ...compare(numerators.reduce((max, value) => absolute(value) > max ? absolute(value) : max, 0n)),
      lines: [...keys, "cash"].map((key, i) => ({
        key, currentBasisPoints: weight(key === "cash" ? input.cashMinor : values.get(key) ?? 0n).toString(),
        targetBasisPoints: (key === "cash" ? BigInt(plan.allocation.cashBps) : targets.get(key) ?? 0n).toString(),
        deviationBasisPoints: roundDivide(numerators[i], total!).toString(),
      })),
    };
  }
  const concentrationReason = valuationReason ?? (invested <= 0n ? "no-holdings" : null);
  return {
    period: { startedAt: new Date(started).toISOString(), endedAt: input.asOf },
    ipsVersion: plan ? input.ips!.version : null,
    hhi: concentrationReason ? unavailable(concentrationReason) : information(roundDivide(
      input.holdings.reduce((sum, holding) => sum + holding.marketValueMinor! ** 2n, 0n) * BPS, invested ** 2n)),
    largestPosition: { ...(concentrationReason ? unavailable(concentrationReason) : information(weight(largest!.marketValueMinor!))), symbol: largest?.symbol ?? null },
    costs: { ...information(fees + fx), feesMinor: fees.toString(), fxMarkupMinor: fx.toString() },
    turnover: { ...(valuationReason ? unavailable(valuationReason) : information(weight(gross))), grossMinor: gross.toString(), tradeCount: trades.length },
    allocation, cash,
  };
}
