import { priceToDecimal, quantityToDecimal } from "@/features/portfolio/decimal";
import { evaluateTraining, maxBuyAmountMinor, type TrainingPlan, type TrainingSetup, type TrainingState } from "./domain";
import { trainingScenarios, type TrainingSource } from "./scenarios";

const monthName = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric", timeZone: "UTC" });

export function trainingMonthLabel(source: TrainingSource, date: string, month: number) {
  return source.kind === "model" ? `Měsíc ${month}` : monthName.format(new Date(`${date}T00:00:00Z`));
}

/** Client-safe view: money as minor-unit strings and only the months revealed so far, never future prices. */
export function presentTraining(session: { id: string; scenarioId: string; plan: TrainingPlan; series: { source: TrainingSource } }, setup: TrainingSetup, state: TrainingState) {
  const scenario = trainingScenarios.find(({ id }) => id === session.scenarioId);
  const label = (month: number) => trainingMonthLabel(session.series.source, setup.dates[month], month);
  const evaluation = state.finished ? evaluateTraining(setup, state) : null;
  return {
    sessionId: session.id,
    scenario: { id: session.scenarioId, title: scenario?.title ?? session.scenarioId, description: scenario?.description ?? "" },
    source: session.series.source,
    month: state.month, lastMonth: state.lastMonth, finished: state.finished, monthLabel: label(state.month),
    points: state.values.map((value, month) => ({ month, label: label(month), price: priceToDecimal(setup.prices[month]), valueMinor: value.toString() })),
    cashMinor: state.cashMinor.toString(), quantity: quantityToDecimal(state.quantityUnits), valueMinor: state.valueMinor.toString(),
    contributedMinor: state.contributedMinor.toString(), initialCapitalMinor: setup.initialCapitalMinor.toString(),
    maxBuyAmountMinor: state.finished ? "0" : maxBuyAmountMinor(setup, state).toString(),
    plan: session.plan, feeProfileName: setup.feeProfile.name,
    trades: state.trades.map(({ month, side, quantityUnits, grossMinor, feeMinor, planStatus }) => ({ month, side, planStatus, label: label(month),
      quantity: quantityToDecimal(quantityUnits), grossMinor: grossMinor.toString(), feeMinor: feeMinor.toString() })),
    evaluation: evaluation && {
      endingMinor: evaluation.endingMinor.toString(), contributedMinor: evaluation.contributedMinor.toString(), gainMinor: evaluation.gainMinor.toString(),
      twr: evaluation.twr, mwr: evaluation.mwr,
      feesMinor: evaluation.feesMinor.toString(), grossTradedMinor: evaluation.grossTradedMinor.toString(), tradeCount: evaluation.tradeCount,
      turnoverBps: evaluation.turnoverBps?.toString() ?? null, sellsOutsidePlan: evaluation.sellsOutsidePlan,
      allocation: { ...evaluation.allocation, investedBps: evaluation.allocation.investedBps?.toString() ?? null },
      indexMaxDrawdownBps: evaluation.indexMaxDrawdownBps.toString(),
    },
  };
}

export type TrainingView = ReturnType<typeof presentTraining>;
