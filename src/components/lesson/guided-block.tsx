import katex from "katex";
import type { ReactNode } from "react";
import { Bookmark, BookOpenCheck, Calculator, ChartPie, Flag, Lightbulb, Sigma, SlidersHorizontal } from "lucide-react";
import { AssetComparison, BondCashflowExplorer, DiversificationImpact, DiversificationPreview, DrawdownExplorer, EtfHoldingsVisual, GrowthComparison, LiquidityComparison, MarketQuoteExplorer, PortfolioHorizonScenario, RiskCapacityScenario, RiskScenarioExplorer, ShareExplorer, StockPositionExplorer, TimeHorizonExplorer, IndexEtfVisual } from "./foundations-explorers";
import type { LessonBlock } from "@/features/lessons/types";
import type { LessonHistoryEntry } from "@/features/lessons/real-history/snapshot";
import { cn } from "@/lib/utils";
import { CompoundingExplorer } from "./compounding-explorer";
import { ReturnCalculator } from "./return-calculator";
import { PriceSeriesExplorer } from "./price-series-explorer";
import { HistoricalReturnsExercise } from "./historical-returns-exercise";
import { RecoveryExplorer } from "./recovery-explorer";
import { PortfolioBuilder } from "./portfolio-builder";

const eyebrow = "text-[11px] font-semibold tracking-[0.9px] uppercase md:text-xs md:tracking-[1px]";
const blockTitle = "text-[19px]/6 font-semibold tracking-[-0.3px] md:text-[21px]/[26px]";

/** Presentation adapter for existing authored blocks, not a second content source. */
export function GuidedBlock({ block, history }: { block: LessonBlock; history?: readonly LessonHistoryEntry[] }) {
  switch (block.type) {
    case "heading": return <div className="flex flex-col gap-2"><h3 className="text-[21px]/[26px] font-semibold tracking-[-0.5px] md:text-2xl/[30px]">{block.title}</h3>{block.body ? <p className="text-base/[25px] text-secondary">{block.body}</p> : null}</div>;
    case "paragraph": return <p className="text-base/[25px] text-secondary">{block.content}</p>;
    case "formula": return <Formula latex={block.latex ?? block.expression} variables={block.variables} />;
    case "workedExample": return <section aria-labelledby={`${block.id}-title`} className="flex flex-col gap-3.5 rounded-surface border border-border-card bg-surface p-[18px] md:gap-[18px] md:px-7 md:py-6">
      <div className="flex flex-col gap-1.5">
        <p className={cn(eyebrow, "flex items-center gap-1.5 text-primary")}><Calculator aria-hidden="true" className="size-3.5" />Řešený příklad</p>
        <h3 id={`${block.id}-title`} className={blockTitle}>{block.title}</h3>
      </div>
      {block.introduction ? <p className="text-[15px]/[23px] text-secondary">{block.introduction}</p> : null}
      <dl className="flex flex-col gap-1">{block.steps.map((step) => {
        const stacked = step.emphasis || step.value.length > 14;
        return <div key={step.label} className={cn("rounded-md px-2.5 py-[9px]", step.emphasis ? "bg-primary-soft" : "bg-surface-sunken", stacked ? "flex flex-col gap-0.5" : "flex items-center justify-between gap-3")}>
          <dt className={cn("text-sm/5", step.emphasis ? "font-semibold text-primary" : "text-secondary")}>{step.label}</dt>
          <dd className={cn("font-semibold tracking-[-0.2px] tabular-nums text-foreground", stacked ? "text-base/[21px]" : "text-right text-[17px]/[22px]")}>{step.value}</dd>
        </div>;
      })}</dl>
      <p className="border-l-2 border-primary-tint pl-3 text-[15px]/[23px] text-foreground">{block.conclusion}</p>
    </section>;
    case "conceptCallout": return <Titled as="aside" icon={<Lightbulb aria-hidden="true" className="mt-[3px] size-4 shrink-0 text-primary" />} title={block.title} className="gap-1.5 rounded-control bg-surface-practice p-4 md:px-5" titleClassName="text-base/[22px] font-semibold"><p className="text-[15px]/[23px] text-foreground">{block.content}</p></Titled>;
    case "explanation": return <section className="flex flex-col gap-1.5 border-l-[3px] border-primary-tint py-0.5 pl-3.5"><h3 className={blockTitle}>{block.title}</h3><p className="text-base/[25px] text-secondary">{block.content}</p></section>;
    case "takeaway": return <Titled icon={<Bookmark aria-hidden="true" className="size-4 shrink-0 text-primary" />} title={block.title} className="gap-2 rounded-control border border-border bg-surface p-4 md:px-5" titleClassName="text-base font-semibold"><p className="text-[15px]/[23px] text-foreground">{block.content}</p></Titled>;
    case "checkpoint": return <Titled icon={<Flag aria-hidden="true" className="size-4 shrink-0 text-muted" />} title={block.label} className="gap-1.5 border-t border-divider pt-3.5" titleClassName="text-sm font-semibold text-muted"><p className="text-[15px]/[23px] text-secondary">{block.content}</p></Titled>;
    case "labBridge": return <Titled as="aside" icon={<ChartPie aria-hidden="true" className="size-4 shrink-0 text-primary" />} title={block.title} className="gap-2 rounded-surface bg-surface-muted px-[18px] py-4 md:px-6" titleClassName="text-base/[22px] font-semibold text-primary"><p className="text-[15px]/[23px] text-foreground">{block.content}</p></Titled>;
    case "lessonSummary": return <section aria-labelledby={`${block.id}-title`} className="overflow-hidden rounded-surface border border-border-card bg-surface shadow-elevation-1">
      <div className="flex items-center gap-2.5 bg-primary-soft px-[18px] py-3.5 md:px-7"><BookOpenCheck aria-hidden="true" className="size-[18px] shrink-0 text-primary" /><h3 id={`${block.id}-title`} className={blockTitle}>{block.title}</h3></div>
      <p className="px-[18px] pt-4 pb-5 text-base/[25px] text-foreground md:px-7">{block.content}</p>
    </section>;
    case "interactiveFigure": return <section aria-labelledby={`${block.id}-title`} className="overflow-hidden rounded-surface border border-primary/30 bg-surface shadow-elevation-1">
      <div className="flex flex-col gap-1.5 border-b border-primary/20 bg-primary-soft px-[18px] py-4 md:px-7 md:py-5">
        <p className={cn(eyebrow, "flex items-center gap-1.5 text-primary")}><SlidersHorizontal aria-hidden="true" className="size-3.5" />Vyzkoušej si</p>
        <h3 id={`${block.id}-title`} className="text-xl/[26px] font-semibold tracking-[-0.3px] md:text-[22px]/7">{block.title}</h3>
        <p className="text-sm/[21px] text-secondary md:text-[15px]/[23px]">{block.description}</p>
      </div>
      <div className="p-4 pb-[18px] md:p-7">{block.figure === "growth-comparison" ? <GrowthComparison /> : block.figure === "ownership-explorer" ? <ShareExplorer kind="ownership" /> : block.figure === "market-cap-explorer" ? <ShareExplorer kind="market-cap" /> : block.figure === "stock-position-explorer" ? <StockPositionExplorer /> : block.figure === "index-etf-visual" ? <IndexEtfVisual /> : block.figure === "etf-holdings-visual" ? <EtfHoldingsVisual /> : block.figure === "bond-cashflow-explorer" ? <BondCashflowExplorer /> : block.figure === "asset-comparison" ? <AssetComparison /> : block.figure === "market-quote-explorer" ? <MarketQuoteExplorer /> : block.figure === "liquidity-comparison" ? <LiquidityComparison /> : block.figure === "risk-scenario-explorer" ? <RiskScenarioExplorer /> : block.figure === "drawdown-explorer" ? <DrawdownExplorer /> : block.figure === "diversification-preview" ? <DiversificationPreview /> : block.figure === "time-horizon-explorer" ? <TimeHorizonExplorer /> : block.figure === "portfolio-builder" ? <PortfolioBuilder /> : block.figure === "diversification-impact" ? <DiversificationImpact /> : block.figure === "portfolio-horizon-scenario" ? <PortfolioHorizonScenario /> : block.figure === "risk-capacity-scenario" ? <RiskCapacityScenario /> : block.figure === "return-calculator" ? <ReturnCalculator /> : block.figure === "price-series-explorer" ? <PriceSeriesExplorer /> : block.figure === "historical-period-returns" ? <HistoricalReturnsExercise mode="period" history={history} /> : block.figure === "historical-cumulative-returns" ? <HistoricalReturnsExercise mode="cumulative" history={history} /> : block.figure === "compounding-explorer" ? <CompoundingExplorer /> : block.figure === "recovery-explorer" ? <RecoveryExplorer /> : null}</div>
    </section>;
    default: return null; // Questions own their Check → feedback → Continue interaction.
  }
}

function Titled({ as: Tag = "section", icon, title, className, titleClassName, children }: { as?: "section" | "aside"; icon: ReactNode; title: string; className: string; titleClassName: string; children: ReactNode }) {
  return <Tag aria-label={Tag === "aside" ? title : undefined} className={cn("flex flex-col", className)}>
    <div className="flex items-start gap-2">{icon}<h3 className={cn("min-w-0 flex-1 tracking-normal", titleClassName)}>{title}</h3></div>
    {children}
  </Tag>;
}

function Formula({ latex, variables }: { latex: string; variables: { symbol: string; description: string }[] }) {
  let html: string | undefined;
  try {
    html = katex.renderToString(latex, { displayMode: true, output: "htmlAndMathml", throwOnError: true, trust: false, strict: "error" });
  } catch {
    html = undefined;
  }
  return <figure className="overflow-hidden rounded-surface border border-border bg-surface">
    <div className="flex flex-col gap-3.5 px-[18px] pt-4 pb-[22px] md:gap-[18px] md:px-7 md:pt-5 md:pb-[30px]">
      <p className={cn(eyebrow, "flex items-center gap-1.5 text-muted")}><Sigma aria-hidden="true" className="size-3.5" />Vzorec</p>
      {html ? <div className="lesson-formula overflow-x-auto text-[23px] text-foreground md:text-[30px]" dangerouslySetInnerHTML={{ __html: html }} /> : <div role="status"><p className="text-sm text-danger">Tento vzorec se nepodařilo zobrazit.</p><code className="break-all text-sm">{latex}</code></div>}
    </div>
    {variables.length ? <div className="flex flex-col gap-2 border-t border-divider bg-surface-sunken px-[18px] pt-3.5 pb-4 md:gap-2.5 md:px-7 md:pt-4 md:pb-[18px]">
      <p className={cn(eyebrow, "text-muted")}>Co znamenají symboly</p>
      <dl className="flex flex-col gap-2 md:gap-2.5">{variables.map(({ symbol, description }) => <div key={symbol} className="flex items-center gap-3">
        <dt className="w-20 shrink-0 text-[19px]/[22px] text-foreground md:w-24 md:text-[21px]/6"><MathSymbol symbol={symbol} /></dt>
        <dd lang="cs" className="min-w-0 flex-1 text-sm/[21px] text-secondary md:text-[15px]/[23px] [overflow-wrap:normal]">{description}</dd>
      </div>)}</dl>
    </div> : null}
  </figure>;
}

/** Authored symbols are plain text ("V_0", "P_(t−1)", "Vᵢ"); typeset them like the formula without a second MathML tree. */
function MathSymbol({ symbol }: { symbol: string }) {
  const match = /^([A-Za-z]+|Π)([₀-₉ᵢₚ]*)(?:_\(?([^)]*)\)?)?$/.exec(symbol);
  if (!match) return <span className="font-[KaTeX_Main,serif]">{symbol}</span>;
  const [, base, unicodeSub, sub] = match;
  return <span className="font-[KaTeX_Main,serif] whitespace-nowrap">
    <span className={base.length === 1 && base !== "Π" ? "font-[KaTeX_Math,serif] italic" : undefined}>{base}</span>{unicodeSub}
    {sub ? <sub className="text-[0.63em]">{/^[A-Za-z]$/.test(sub) ? <span className="font-[KaTeX_Math,serif] italic">{sub}</span> : sub}</sub> : null}
  </span>;
}
