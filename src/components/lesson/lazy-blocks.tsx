"use client";

import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { lessonFigureCatalog } from "@/features/lessons/figure-catalog";
import { FigureDataLabel } from "@/components/learning/figure-data-label";
import type { LessonBlock } from "@/features/lessons/types";
import type { LessonHistoryEntry } from "@/features/lessons/real-history/snapshot";
import type { RiskHistoryEntry } from "@/features/lessons/real-history/risk-window";

/**
 * Interactive figures and KaTeX load per block (issue #131): a lesson downloads only the figure modules it shows,
 * so new lessons and figures do not grow every lesson's JavaScript. Server rendering is unchanged.
 */
type FigureKind = Extract<LessonBlock, { type: "interactiveFigure" }>["figure"];
type FigureData = { onOutputReady?: (blockId: string, ready: boolean) => void; guest?: boolean; emergencyFundFacts?: import("@/features/lessons/before-investing/emergency-fund-model").EmergencyFundFacts; history?: readonly LessonHistoryEntry[]; riskHistory?: readonly RiskHistoryEntry[] };

function Placeholder() {
  return <div role="status" className="min-h-40 animate-pulse rounded-control bg-surface-sunken motion-reduce:animate-none"><span className="sr-only">Načítám…</span></div>;
}

/**
 * A component from a lazily loaded module. `next/dynamic` and `React.lazy` suspend on the first client render even
 * when the module is already loaded, and React then holds the placeholder for its ~300 ms reveal throttle. Once
 * `preload` has resolved, this renders the component directly. Both paths sit in the same Suspense boundary, so
 * the server HTML hydrates whichever path the client takes.
 */
function lazyComponent<M, P extends object>(load: () => Promise<M>, pick: (module: M) => ComponentType<P>) {
  let loaded: ComponentType<P> | undefined;
  const preload = () => load().then((module) => (loaded = pick(module)));
  const Lazy = lazy(() => preload().then((component) => ({ default: component })));
  function LazyComponent(props: P) {
    const Loaded = loaded;
    return <Suspense fallback={<Placeholder />}>{Loaded ? <Loaded {...props} /> : <Lazy {...props} />}</Suspense>;
  }
  return Object.assign(LazyComponent, { preload });
}

const foundations = () => import("./foundations-explorers");
const volatility = () => import("./volatility-explorers");
const correlation = () => import("./correlation-explorers");
const diversification = () => import("./diversification-explorers");

const GrowthComparison = lazyComponent(foundations, (module) => module.GrowthComparison);
const ShareExplorer = lazyComponent(foundations, (module) => module.ShareExplorer);
const StockPositionExplorer = lazyComponent(foundations, (module) => module.StockPositionExplorer);
const IndexEtfVisual = lazyComponent(foundations, (module) => module.IndexEtfVisual);
const EtfHoldingsVisual = lazyComponent(foundations, (module) => module.EtfHoldingsVisual);
const BondCashflowExplorer = lazyComponent(foundations, (module) => module.BondCashflowExplorer);
const AssetComparison = lazyComponent(foundations, (module) => module.AssetComparison);
const MarketQuoteExplorer = lazyComponent(foundations, (module) => module.MarketQuoteExplorer);
const LiquidityComparison = lazyComponent(foundations, (module) => module.LiquidityComparison);
const RiskScenarioExplorer = lazyComponent(foundations, (module) => module.RiskScenarioExplorer);
const DrawdownExplorer = lazyComponent(foundations, (module) => module.DrawdownExplorer);
const DiversificationPreview = lazyComponent(foundations, (module) => module.DiversificationPreview);
const TimeHorizonExplorer = lazyComponent(foundations, (module) => module.TimeHorizonExplorer);
const DiversificationImpact = lazyComponent(foundations, (module) => module.DiversificationImpact);
const PortfolioHorizonScenario = lazyComponent(foundations, (module) => module.PortfolioHorizonScenario);
const RiskCapacityScenario = lazyComponent(foundations, (module) => module.RiskCapacityScenario);
const PortfolioBuilder = lazyComponent(() => import("./portfolio-builder"), (module) => module.PortfolioBuilder);
const EmergencyFundCalculator = lazyComponent(() => import("./emergency-fund-calculator"), (module) => module.EmergencyFundCalculator);
const StateSupportCalculator = lazyComponent(() => import("./state-support-calculator"), (module) => module.StateSupportCalculator);
const DebtVsInvestCalculator = lazyComponent(() => import("./debt-vs-invest-calculator"), (module) => module.DebtVsInvestCalculator);
const BudgetBuilder = lazyComponent(() => import("./budget-builder"), (module) => module.BudgetBuilder);
const GoalMap = lazyComponent(() => import("./goal-map"), (module) => module.GoalMap);
const ReturnCalculator = lazyComponent(() => import("./return-calculator"), (module) => module.ReturnCalculator);
const PriceSeriesExplorer = lazyComponent(() => import("./price-series-explorer"), (module) => module.PriceSeriesExplorer);
const HistoricalReturnsExercise = lazyComponent(() => import("./historical-returns-exercise"), (module) => module.HistoricalReturnsExercise);
const CompoundingExplorer = lazyComponent(() => import("./compounding-explorer"), (module) => module.CompoundingExplorer);
const RecoveryExplorer = lazyComponent(() => import("./recovery-explorer"), (module) => module.RecoveryExplorer);
const VolatilityPaths = lazyComponent(volatility, (module) => module.VolatilityPaths);
const StandardDeviationExplorer = lazyComponent(volatility, (module) => module.StandardDeviationExplorer);
const AnnualisationExplorer = lazyComponent(volatility, (module) => module.AnnualisationExplorer);
const MaxDrawdownExplorer = lazyComponent(volatility, (module) => module.MaxDrawdownExplorer);
const HistoricalRiskExercise = lazyComponent(() => import("./historical-risk-exercise"), (module) => module.HistoricalRiskExercise);
const CorrelationExplorer = lazyComponent(correlation, (module) => module.CorrelationExplorer);
const CommonFactorExplorer = lazyComponent(correlation, (module) => module.CommonFactorExplorer);
const CrisisCorrelationExplorer = lazyComponent(correlation, (module) => module.CrisisCorrelationExplorer);
const HistoricalCorrelationExercise = lazyComponent(() => import("./historical-correlation-exercise"), (module) => module.HistoricalCorrelationExercise);
const ConcentrationExplorer = lazyComponent(diversification, (module) => module.ConcentrationExplorer);
const ExposureExplorer = lazyComponent(diversification, (module) => module.ExposureExplorer);
const LookThroughExplorer = lazyComponent(diversification, (module) => module.LookThroughExplorer);
const PortfolioCorrelationExplorer = lazyComponent(diversification, (module) => module.PortfolioCorrelationExplorer);
const DiversificationScenario = lazyComponent(() => import("./diversification-scenario"), (module) => module.DiversificationScenario);
export const LessonFormula = lazyComponent(() => import("./lesson-formula"), (module) => module.Formula);

/** Every figure kind with its preload and how to render it. The record keeps the list exhaustive. */
const figures: Record<FigureKind, { preload: () => Promise<unknown>; render: (data: FigureData) => ReactNode }> = {
  "goal-map": { preload: GoalMap.preload, render: ({ guest, onOutputReady }) => <GoalMap guest={guest} onReady={onOutputReady} /> },
  "growth-comparison": { preload: GrowthComparison.preload, render: () => <GrowthComparison /> },
  "ownership-explorer": { preload: ShareExplorer.preload, render: () => <ShareExplorer kind="ownership" /> },
  "market-cap-explorer": { preload: ShareExplorer.preload, render: () => <ShareExplorer kind="market-cap" /> },
  "stock-position-explorer": { preload: StockPositionExplorer.preload, render: () => <StockPositionExplorer /> },
  "index-etf-visual": { preload: IndexEtfVisual.preload, render: () => <IndexEtfVisual /> },
  "etf-holdings-visual": { preload: EtfHoldingsVisual.preload, render: () => <EtfHoldingsVisual /> },
  "bond-cashflow-explorer": { preload: BondCashflowExplorer.preload, render: () => <BondCashflowExplorer /> },
  "asset-comparison": { preload: AssetComparison.preload, render: () => <AssetComparison /> },
  "market-quote-explorer": { preload: MarketQuoteExplorer.preload, render: () => <MarketQuoteExplorer /> },
  "liquidity-comparison": { preload: LiquidityComparison.preload, render: () => <LiquidityComparison /> },
  "risk-scenario-explorer": { preload: RiskScenarioExplorer.preload, render: () => <RiskScenarioExplorer /> },
  "drawdown-explorer": { preload: DrawdownExplorer.preload, render: () => <DrawdownExplorer /> },
  "diversification-preview": { preload: DiversificationPreview.preload, render: () => <DiversificationPreview /> },
  "time-horizon-explorer": { preload: TimeHorizonExplorer.preload, render: () => <TimeHorizonExplorer /> },
  "diversification-impact": { preload: DiversificationImpact.preload, render: () => <DiversificationImpact /> },
  "portfolio-horizon-scenario": { preload: PortfolioHorizonScenario.preload, render: () => <PortfolioHorizonScenario /> },
  "risk-capacity-scenario": { preload: RiskCapacityScenario.preload, render: () => <RiskCapacityScenario /> },
  "portfolio-builder": { preload: PortfolioBuilder.preload, render: () => <PortfolioBuilder /> },
  "emergency-fund-calculator": { preload: EmergencyFundCalculator.preload, render: ({ emergencyFundFacts }) => <EmergencyFundCalculator facts={emergencyFundFacts} /> },
  "state-support-calculator": { preload: StateSupportCalculator.preload, render: () => <StateSupportCalculator /> },
  "debt-vs-invest-calculator": { preload: DebtVsInvestCalculator.preload, render: () => <DebtVsInvestCalculator /> },
  "budget-builder": { preload: BudgetBuilder.preload, render: () => <BudgetBuilder /> },
  "return-calculator": { preload: ReturnCalculator.preload, render: () => <ReturnCalculator /> },
  "price-series-explorer": { preload: PriceSeriesExplorer.preload, render: () => <PriceSeriesExplorer /> },
  "historical-period-returns": { preload: HistoricalReturnsExercise.preload, render: ({ history }) => <HistoricalReturnsExercise mode="period" history={history} /> },
  "historical-cumulative-returns": { preload: HistoricalReturnsExercise.preload, render: ({ history }) => <HistoricalReturnsExercise mode="cumulative" history={history} /> },
  "compounding-explorer": { preload: CompoundingExplorer.preload, render: () => <CompoundingExplorer /> },
  "recovery-explorer": { preload: RecoveryExplorer.preload, render: () => <RecoveryExplorer /> },
  "volatility-paths": { preload: VolatilityPaths.preload, render: () => <VolatilityPaths /> },
  "standard-deviation-explorer": { preload: StandardDeviationExplorer.preload, render: () => <StandardDeviationExplorer /> },
  "annualisation-explorer": { preload: AnnualisationExplorer.preload, render: () => <AnnualisationExplorer /> },
  "max-drawdown-explorer": { preload: MaxDrawdownExplorer.preload, render: () => <MaxDrawdownExplorer /> },
  "historical-volatility": { preload: HistoricalRiskExercise.preload, render: ({ riskHistory }) => <HistoricalRiskExercise mode="volatility" history={riskHistory} /> },
  "historical-drawdown": { preload: HistoricalRiskExercise.preload, render: ({ riskHistory }) => <HistoricalRiskExercise mode="max-drawdown" history={riskHistory} /> },
  "correlation-explorer": { preload: CorrelationExplorer.preload, render: () => <CorrelationExplorer /> },
  "common-factor-explorer": { preload: CommonFactorExplorer.preload, render: () => <CommonFactorExplorer /> },
  "crisis-correlation-explorer": { preload: CrisisCorrelationExplorer.preload, render: () => <CrisisCorrelationExplorer /> },
  "historical-correlation": { preload: HistoricalCorrelationExercise.preload, render: ({ riskHistory }) => <HistoricalCorrelationExercise history={riskHistory} /> },
  "concentration-explorer": { preload: ConcentrationExplorer.preload, render: () => <ConcentrationExplorer /> },
  "exposure-explorer": { preload: ExposureExplorer.preload, render: () => <ExposureExplorer /> },
  "look-through-explorer": { preload: LookThroughExplorer.preload, render: () => <LookThroughExplorer /> },
  "portfolio-correlation-explorer": { preload: PortfolioCorrelationExplorer.preload, render: () => <PortfolioCorrelationExplorer /> },
  "diversification-scenario": { preload: DiversificationScenario.preload, render: () => <DiversificationScenario /> },
};

export function LessonFigure({ figure, ...data }: { figure: FigureKind } & FigureData) {
  return <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
    {lessonFigureCatalog[figure].data === "model" ? <FigureDataLabel data={{ kind: "model" }} /> : null}
    {figures[figure].render(data)}
  </div>;
}

/** Loads the figure and formula modules a lesson uses, so its later steps render them without a placeholder. */
export function preloadLessonBlocks(blocks: readonly LessonBlock[]) {
  const preloads = new Set<() => Promise<unknown>>();
  for (const block of blocks) {
    if (block.type === "interactiveFigure") preloads.add(figures[block.figure].preload);
    else if (block.type === "formula") preloads.add(LessonFormula.preload);
  }
  // A failed preload is retried by the block itself when it renders.
  for (const preload of preloads) void preload().catch(() => undefined);
}
