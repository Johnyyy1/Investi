import { DecisionTree } from "./decision-tree";
import { LessonOutput } from "./lesson-output";
// The KaTeX stylesheet stays static so a server-rendered formula is styled before its lazy module arrives.
import "katex/dist/katex.min.css";
import type { ReactNode } from "react";
import { ArrowRight, Bookmark, BookOpenCheck, Calculator, ChartPie, Flag, Lightbulb, SlidersHorizontal } from "lucide-react";
import { AppLink as Link } from "@/components/shell/app-link";
import type { LessonBlock } from "@/features/lessons/types";
import type { LessonHistoryEntry } from "@/features/lessons/real-history/snapshot";
import type { RiskHistoryEntry } from "@/features/lessons/real-history/risk-window";
import { metricLabLink } from "@/features/learning/metric-glossary";
import { cn } from "@/lib/utils";
import { LessonFigure, LessonFormula } from "./lazy-blocks";
import { FactNotice } from "./step-kinds/fact-notice";
import { LabMission } from "./step-kinds/lab-mission";
import { PersonaDecision } from "./step-kinds/persona-decision";
import { WrittenReflection } from "./step-kinds/written-reflection";

const eyebrow = "text-[11px] font-semibold tracking-[0.9px] uppercase md:text-xs md:tracking-[1px]";
const blockTitle = "text-[19px]/6 font-semibold tracking-[-0.3px] md:text-[21px]/[26px]";

/** Presentation adapter for existing authored blocks, not a second content source. */
export function GuidedBlock({ block, history, riskHistory, lessonId, guest, onOutputReady }: { block: LessonBlock; lessonId?: string; guest?: boolean; onOutputReady?: (blockId: string, ready: boolean) => void; history?: readonly LessonHistoryEntry[]; riskHistory?: readonly RiskHistoryEntry[] }) {
  switch (block.type) {
    case "decisionTree": return <DecisionTree block={block} />;
    case "checklist":
    case "rubricSelfAssessment": return lessonId ? <LessonOutput block={block} lessonId={lessonId} guest={guest} onReady={onOutputReady} /> : null;
    case "heading": return <div className="flex flex-col gap-2"><h3 className="text-[21px]/[26px] font-semibold tracking-[-0.5px] md:text-2xl/[30px]">{block.title}</h3>{block.body ? <p className="text-base/[25px] text-secondary">{block.body}</p> : null}</div>;
    case "paragraph": return <p className="text-base/[25px] text-secondary">{block.content}</p>;
    case "formula": return <LessonFormula latex={block.latex ?? block.expression} variables={block.variables} />;
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
    case "labBridge": return <Titled as="aside" icon={<ChartPie aria-hidden="true" className="size-4 shrink-0 text-primary" />} title={block.title} className="gap-2 rounded-surface bg-surface-muted px-[18px] py-4 md:px-6" titleClassName="text-base/[22px] font-semibold text-primary"><p className="text-[15px]/[23px] text-foreground">{block.content}</p>{block.metric ? <LabMetricLink {...metricLabLink(block.metric, lessonInstrumentHref(riskHistory, history))} /> : null}</Titled>;
    case "lessonSummary": return <section aria-labelledby={`${block.id}-title`} className="overflow-hidden rounded-surface border border-border-card bg-surface shadow-elevation-1">
      <div className="flex items-center gap-2.5 bg-primary-soft px-[18px] py-3.5 md:px-7"><BookOpenCheck aria-hidden="true" className="size-[18px] shrink-0 text-primary" /><h3 id={`${block.id}-title`} className={blockTitle}>{block.title}</h3></div>
      <p className="px-[18px] pt-4 pb-5 text-base/[25px] text-foreground md:px-7">{block.content}</p>
    </section>;
    case "interactiveFigure": return <section aria-labelledby={`${block.id}-title`} className="overflow-hidden rounded-surface border border-primary/30 bg-surface shadow-elevation-1">
      <div className="flex flex-col gap-1.5 border-b border-primary/20 bg-primary-soft px-[18px] py-4 md:px-7 md:py-5">
        <p className={cn(eyebrow, "flex items-center gap-1.5 text-primary")}><SlidersHorizontal aria-hidden="true" className="size-3.5" />Vyzkoušej si</p>
        <h3 id={`${block.id}-title`} className="text-xl/[1.3] font-semibold tracking-[-0.3px] [overflow-wrap:anywhere] md:text-[1.375rem]/[1.273]">{block.title}</h3>
        <p className="text-sm/[1.5] text-secondary [overflow-wrap:anywhere] md:text-[0.9375rem]/[1.533]">{block.description}</p>
      </div>
      <div className={cn("py-4 pb-[18px] md:p-7", block.figure === "emergency-fund-calculator" ? "px-2" : "px-4")}><LessonFigure figure={block.figure} emergencyFundFacts={block.emergencyFundFacts} history={history} riskHistory={riskHistory} /></div>
    </section>;
    case "personaDecision": return <PersonaDecision block={block} />;
    case "labMission": return <LabMission block={block} />;
    case "factNotice": return <FactNotice id={block.id} factKeys={block.factKeys} />;
    case "writtenReflection": return <WrittenReflection block={block} />;
    default: return null; // Questions own their Check → feedback → Continue interaction.
  }
}

/** The instrument the lesson's own historical figure uses, so the Lab opens on the same data. */
function lessonInstrumentHref(...entries: (readonly (LessonHistoryEntry | RiskHistoryEntry)[] | undefined)[]) {
  for (const entry of entries.flatMap((list) => list ?? [])) if (entry.status === "ok" && entry.snapshot.labHref) return entry.snapshot.labHref;
  return null;
}

function LabMetricLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-primary-hover underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary">{label}<ArrowRight aria-hidden="true" className="size-4" /></Link>;
}

function Titled({ as: Tag = "section", icon, title, className, titleClassName, children }: { as?: "section" | "aside"; icon: ReactNode; title: string; className: string; titleClassName: string; children: ReactNode }) {
  return <Tag aria-label={Tag === "aside" ? title : undefined} className={cn("flex flex-col", className)}>
    <div className="flex items-start gap-2">{icon}<h3 className={cn("min-w-0 flex-1 tracking-normal", titleClassName)}>{title}</h3></div>
    {children}
  </Tag>;
}
