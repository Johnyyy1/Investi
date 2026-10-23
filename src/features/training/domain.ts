import type { IpsPlan } from "@/features/ips/schema";
import { computeTradeCost, type BrokerFeeProfile } from "@/features/portfolio/costs";
import { FX_SCALE, grossBaseMinor, PRICE_SCALE, QUANTITY_SCALE, roundDivide } from "@/features/portfolio/decimal";
import { moneyWeightedReturn, PERFORMANCE_DAY_MS, timeWeightedReturn, type PerformanceMetric } from "@/features/portfolio/performance";

/** Fictional training money, separate from Practice Capital: 100 000 Kč at the start of every session. */
export const TRAINING_INITIAL_CAPITAL_MINOR = 10_000_000n;
const BPS = 10_000n;

/** The structured IPS parts a session freezes at its start; the learner's free text is not copied. */
export interface TrainingPlan {
  ipsVersion: number;
  contributionMinor: string;
  /** Everything except the IPS cash target: the scenario has one invested index and cash. */
  targetInvestedBps: number;
  rebalancing: IpsPlan["rebalancing"];
  drawdownAction: IpsPlan["drawdownRule"]["action"];
}

export function trainingPlanFromIps(plan: IpsPlan, ipsVersion: number): TrainingPlan {
  return {
    ipsVersion, contributionMinor: plan.contribution.amountMinor, targetInvestedBps: 10_000 - plan.allocation.cashBps,
    rebalancing: plan.rebalancing, drawdownAction: plan.drawdownRule.action,
  };
}

export interface TrainingSetup {
  /** Month-end dates (YYYY-MM-DD); index 0 is the start month. */
  dates: readonly string[];
  /** Index price in CZK at 8 dp per month, same order as dates. */
  prices: readonly bigint[];
  initialCapitalMinor: bigint;
  plan: TrainingPlan;
  feeProfile: BrokerFeeProfile;
}

export type TrainingAction = { kind: "buy"; amountMinor: bigint } | { kind: "sell"; quantityUnits: bigint } | { kind: "advance" };

export class TrainingActionError extends Error {
  constructor(readonly code: "Finished" | "InvalidAmount" | "InsufficientCash" | "Oversell", message: string) {
    super(message);
    this.name = "TrainingActionError";
  }
}

export interface TrainingTrade {
  month: number;
  side: "BUY" | "SELL";
  quantityUnits: bigint;
  grossMinor: bigint;
  feeMinor: bigint;
  /** Sells only: whether the IPS rebalancing rule allowed selling at that moment. */
  planStatus: "within-plan" | "outside-plan" | null;
}

export interface TrainingState {
  month: number;
  lastMonth: number;
  finished: boolean;
  cashMinor: bigint;
  quantityUnits: bigint;
  valueMinor: bigint;
  contributedMinor: bigint;
  /** Value at each revealed month after that month's actions; the last entry is the current value. */
  values: bigint[];
  contributions: { month: number; amountMinor: bigint; valueBeforeMinor: bigint }[];
  trades: TrainingTrade[];
}

const invested = (quantityUnits: bigint, priceUnits: bigint) => grossBaseMinor(quantityUnits, priceUnits, FX_SCALE);

function buyCost(setup: TrainingSetup, priceUnits: bigint, amountMinor: bigint) {
  // Floor to whole 8 dp units, so the gross never exceeds the amount the learner chose.
  const quantityUnits = amountMinor * QUANTITY_SCALE * PRICE_SCALE / (priceUnits * 100n);
  if (quantityUnits <= 0n) return null;
  return { quantityUnits, cost: computeTradeCost({ quantityUnits, priceUnits, fxUnits: FX_SCALE, quoteCurrency: "CZK", side: "BUY", profile: setup.feeProfile }) };
}

/** Largest whole-haléř amount whose gross plus fee fits in the cash; the fee only grows with the amount. */
export function maxBuyAmountMinor(setup: TrainingSetup, state: Pick<TrainingState, "month" | "cashMinor">) {
  const price = setup.prices[state.month];
  let low = 0n, high = state.cashMinor;
  while (low < high) {
    const middle = (low + high + 1n) / 2n;
    const buy = buyCost(setup, price, middle);
    if (buy && -buy.cost.cashDeltaBaseMinor <= state.cashMinor) low = middle;
    else high = middle - 1n;
  }
  return low;
}

/** Selling is within the plan only to bring an overweight index back: above the band (band mode),
 * above the target in the review month (calendar mode), never when the plan rebalances with contributions. */
function sellStatus(setup: TrainingSetup, month: number, investedMinor: bigint, totalMinor: bigint): "within-plan" | "outside-plan" {
  const { rebalancing, targetInvestedBps } = setup.plan;
  const above = (extraBps: number) => investedMinor * BPS > totalMinor * BigInt(targetInvestedBps + extraBps);
  if (rebalancing.mode === "band") return above(rebalancing.bandBps) ? "within-plan" : "outside-plan";
  if (rebalancing.mode === "calendar") return Number(setup.dates[month].slice(5, 7)) === rebalancing.month && above(0) ? "within-plan" : "outside-plan";
  return "outside-plan";
}

/** Deterministic replay: the same setup and actions always give the same state. Throws on an invalid action. */
export function replayTraining(setup: TrainingSetup, actions: readonly TrainingAction[]): TrainingState {
  const lastMonth = setup.prices.length - 1;
  const contribution = BigInt(setup.plan.contributionMinor);
  let month = 0, cash = setup.initialCapitalMinor, quantity = 0n, contributed = setup.initialCapitalMinor;
  const values: bigint[] = [], contributions: TrainingState["contributions"] = [], trades: TrainingTrade[] = [];
  for (const action of actions) {
    if (month === lastMonth) throw new TrainingActionError("Finished", "Nácvik je u konce. Začni nový, pokud chceš pokračovat.");
    const price = setup.prices[month];
    if (action.kind === "advance") {
      values.push(cash + invested(quantity, price));
      month += 1;
      if (contribution > 0n) {
        contributions.push({ month, amountMinor: contribution, valueBeforeMinor: cash + invested(quantity, setup.prices[month]) });
        cash += contribution;
        contributed += contribution;
      }
    } else if (action.kind === "buy") {
      const buy = action.amountMinor > 0n ? buyCost(setup, price, action.amountMinor) : null;
      if (!buy) throw new TrainingActionError("InvalidAmount", "Zadej částku, za kterou koupíš alespoň malý podíl indexu.");
      if (-buy.cost.cashDeltaBaseMinor > cash) throw new TrainingActionError("InsufficientCash", "Na nákup včetně poplatku nemáš dost tréninkové hotovosti.");
      cash += buy.cost.cashDeltaBaseMinor;
      quantity += buy.quantityUnits;
      trades.push({ month, side: "BUY", quantityUnits: buy.quantityUnits, grossMinor: buy.cost.grossAmountBaseMinor, feeMinor: buy.cost.feeBaseMinor, planStatus: null });
    } else {
      if (action.quantityUnits <= 0n) throw new TrainingActionError("InvalidAmount", "Zadej množství větší než nula.");
      if (action.quantityUnits > quantity) throw new TrainingActionError("Oversell", "Nemůžeš prodat víc podílů, než držíš.");
      const cost = computeTradeCost({ quantityUnits: action.quantityUnits, priceUnits: price, fxUnits: FX_SCALE, quoteCurrency: "CZK", side: "SELL", profile: setup.feeProfile });
      if (cost.cashDeltaBaseMinor <= 0n) throw new TrainingActionError("InvalidAmount", "Prodej je menší než poplatek. Zvol větší množství.");
      const status = sellStatus(setup, month, invested(quantity, price), cash + invested(quantity, price));
      cash += cost.cashDeltaBaseMinor;
      quantity -= action.quantityUnits;
      trades.push({ month, side: "SELL", quantityUnits: action.quantityUnits, grossMinor: cost.grossAmountBaseMinor, feeMinor: cost.feeBaseMinor, planStatus: status });
    }
  }
  const value = cash + invested(quantity, setup.prices[month]);
  return { month, lastMonth, finished: month === lastMonth, cashMinor: cash, quantityUnits: quantity, valueMinor: value, contributedMinor: contributed, values: [...values, value], contributions, trades };
}

export interface TrainingEvaluation {
  endingMinor: bigint;
  contributedMinor: bigint;
  gainMinor: bigint;
  twr: PerformanceMetric;
  mwr: PerformanceMetric;
  feesMinor: bigint;
  grossTradedMinor: bigint;
  tradeCount: number;
  /** Traded gross over the ending value, the same convention as Portfolio Lab process feedback. */
  turnoverBps: bigint | null;
  sellsOutsidePlan: number;
  allocation: { investedBps: bigint | null; targetInvestedBps: number; status: "within-plan" | "outside-plan" | "information" };
  /** Largest fall of the index from a previous high within the revealed months. */
  indexMaxDrawdownBps: bigint;
}

/** Process first: IPS rules, costs and turnover; returns are context. Never a composite score. */
export function evaluateTraining(setup: TrainingSetup, state: TrainingState): TrainingEvaluation {
  const start = setup.dates[0], end = setup.dates[state.month];
  const days = (Date.parse(end) - Date.parse(start)) / PERFORMANCE_DAY_MS;
  const flows = [{ at: start, amountMinor: setup.initialCapitalMinor }, ...state.contributions.map(({ month, amountMinor }) => ({ at: setup.dates[month], amountMinor }))];
  const total = state.valueMinor;
  const investedMinor = invested(state.quantityUnits, setup.prices[state.month]);
  const { rebalancing, targetInvestedBps } = setup.plan;
  const deviation = investedMinor * BPS - total * BigInt(targetInvestedBps);
  let peak = setup.prices[0], deepest = 0n;
  for (const price of setup.prices.slice(0, state.month + 1)) {
    if (price > peak) peak = price;
    const fall = roundDivide((peak - price) * BPS, peak);
    if (fall > deepest) deepest = fall;
  }
  const grossTraded = state.trades.reduce((sum, trade) => sum + trade.grossMinor, 0n);
  return {
    endingMinor: total, contributedMinor: state.contributedMinor, gainMinor: total - state.contributedMinor,
    twr: timeWeightedReturn(setup.initialCapitalMinor, state.contributions, total, days),
    mwr: moneyWeightedReturn(flows, end, total),
    feesMinor: state.trades.reduce((sum, trade) => sum + trade.feeMinor, 0n),
    grossTradedMinor: grossTraded, tradeCount: state.trades.length,
    turnoverBps: total > 0n ? roundDivide(grossTraded * BPS, total) : null,
    sellsOutsidePlan: state.trades.filter((trade) => trade.planStatus === "outside-plan").length,
    allocation: {
      investedBps: total > 0n ? roundDivide(investedMinor * BPS, total) : null, targetInvestedBps,
      status: total <= 0n || rebalancing.mode !== "band" ? "information" : (deviation < 0n ? -deviation : deviation) <= total * BigInt(rebalancing.bandBps) ? "within-plan" : "outside-plan",
    },
    indexMaxDrawdownBps: deepest,
  };
}
