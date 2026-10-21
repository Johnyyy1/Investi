"use client";

import { useId, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, Clock3, CornerDownLeft, Database, Flag, Hourglass } from "lucide-react";
import type { LabMissionTarget, LessonBlock } from "@/features/lessons/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cardTitle, eyebrow, plainCard } from "./shared";

type Block = Extract<LessonBlock, { type: "labMission" }>;

export const labMissionTargets: Record<LabMissionTarget, string> = {
  "/lab/portfolio": "Portfolio Lab",
  "/lab/backtesting": "Backtesting Lab",
  "/lab/compare": "Porovnání instrumentů",
};

/**
 * Design K: an optional mission in an existing Lab area, then an analysis next to the general rule.
 * The Lab opens in a new tab so the lesson keeps its step. Lab data does not flow back into lessons yet,
 * so the analysis is always labelled sample data; never present it as the learner's own portfolio.
 */
export function LabMission({ block }: { block: Block }) {
  const [view, setView] = useState<"brief" | "analysis">("brief");
  const [opened, setOpened] = useState(false);
  const textareaId = useId();
  const { mission, analysis } = block;
  const lab = labMissionTargets[mission.target];
  if (view === "brief") return <section aria-labelledby={`${block.id}-goal`} className={plainCard}>
    <div className="flex flex-col gap-4 p-[18px] md:px-7 md:py-6">
      <div className="flex items-center justify-between gap-3">
        <p className={cn(eyebrow, "flex items-center gap-1.5 text-primary")}><Flag aria-hidden="true" className="size-3.5" />Tvoje mise</p>
        <p className="flex items-center gap-1 text-[13px] text-muted"><Clock3 aria-hidden="true" className="size-3.5" />≈ {mission.minutes} min v Labu</p>
      </div>
      <h3 id={`${block.id}-goal`} className={cardTitle}>{mission.goal}</h3>
      <ol className="flex flex-col gap-2.5">{mission.steps.map((step, index) => <li key={step} className="flex items-start gap-3 text-[15px]/[22px] text-foreground">
        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-secondary">{index + 1}</span>{step}
      </li>)}</ol>
      <aside aria-label="Po návratu" className="flex flex-col gap-1 rounded-control bg-surface-sunken px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-primary"><CornerDownLeft aria-hidden="true" className="size-4" />Po návratu</p>
        <p className="text-sm/[21px] text-secondary">{mission.afterReturn}</p>
      </aside>
      <div className="flex flex-col items-stretch gap-1 pt-1">
        <a href={mission.target} target="_blank" rel="noopener" onClick={() => setOpened(true)} className={buttonVariants({ variant: opened ? "secondary" : "primary" })}>
          Otevřít {lab}<ArrowUpRight aria-hidden="true" className="size-[18px]" /><span className="sr-only"> (otevře se v nové kartě)</span>
        </a>
        <button type="button" onClick={() => setView("analysis")} className={cn(buttonVariants({ variant: opened ? "primary" : "ghost" }), "mt-1")}>
          {opened ? "Jsem zpět, ukaž rozbor" : "Přeskočit, použiju ukázková data"}
        </button>
      </div>
    </div>
  </section>;
  return <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:items-start lg:gap-7">
    <section aria-labelledby={`${block.id}-analysis`} className={cn(plainCard, "min-w-0")}>
      <div className="flex flex-col gap-3.5 p-[18px] md:px-6 md:py-5">
        <div className="flex items-center justify-between gap-3">
          <p className={cn(eyebrow, "flex items-center gap-1.5 text-primary")}><Database aria-hidden="true" className="size-3.5" />Ukázková data</p>
          <p className="text-[13px] text-muted">{analysis.title}</p>
        </div>
        <h3 id={`${block.id}-analysis`} className="text-[17px]/6 font-semibold text-foreground">{analysis.summary}</h3>
        <ul className="flex flex-col divide-y divide-divider">{analysis.rows.map((row, index) => <li key={`${row.label}-${index}`} className="flex flex-col gap-2 py-3 first:pt-1 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-2 text-[15px]/5 font-semibold text-foreground">{row.badge ? <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.6px] text-secondary">{row.badge}</span> : null}{row.label}</p>
            <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold", row.highlight ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary")}><Hourglass aria-hidden="true" className="size-3.5" />{row.status}</span>
          </div>
          {row.progress !== undefined ? <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-track"><div className="h-full rounded-full bg-progress" style={{ width: `${Math.round(Math.min(Math.max(row.progress, 0), 1) * 100)}%` }} /></div> : null}
          {row.start || row.end ? <p className="flex justify-between gap-3 text-[13px] text-secondary"><span>{row.start}</span><span className="font-semibold text-foreground">{row.end}</span></p> : null}
        </li>)}</ul>
        <p className="text-[13px]/[19px] text-muted">Údaje z tvého Labu se do lekce zatím nepřenášejí. Rozbor proto ukazuje modelového investora.</p>
      </div>
    </section>
    <div className="flex min-w-0 flex-col gap-4">
      <aside aria-label="Obecně platí" className="flex flex-col gap-1.5 rounded-surface border border-border bg-surface-muted px-[18px] py-4">
        <p className={cn(eyebrow, "flex items-center gap-1.5 text-muted")}><BookOpen aria-hidden="true" className="size-3.5" />Obecně platí</p>
        <p className="text-[15px]/[23px] text-foreground">{analysis.generalRule}</p>
      </aside>
      <section aria-labelledby={`${block.id}-explain`} className={cn(plainCard, "flex flex-col gap-2.5 p-[18px] md:px-6 md:py-5")}>
        <p className={cn(eyebrow, "text-primary")}>Vysvětli si to</p>
        <h3 id={`${block.id}-explain`} className="text-[19px]/6 font-semibold tracking-[-0.3px]">{analysis.selfExplanationPrompt}</h3>
        <label htmlFor={textareaId} className="text-sm font-semibold text-foreground">Jednou nebo dvěma větami</label>
        <textarea id={textareaId} rows={3} placeholder="Napiš to vlastními slovy…" className="min-h-24 w-full resize-y rounded-control border border-border-strong bg-surface px-3.5 py-3 text-base/6 text-foreground placeholder:text-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[0.5px] focus-visible:ring-primary" />
        <p className="text-[13px]/[19px] text-muted">Nehodnotí se a zatím se nikam neukládá.</p>
      </section>
      <button type="button" onClick={() => setView("brief")} className="inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-primary-hover underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft aria-hidden="true" className="size-4" />Zpět na zadání mise</button>
    </div>
  </div>;
}
