"use client";

import { useState } from "react";
import Image from "next/image";
import { Info, RotateCcw, Scale } from "lucide-react";
import type { LessonBlock } from "@/features/lessons/types";
import { cn } from "@/lib/utils";
import { AnswerChoice } from "../lesson-answer";
import { cardTitle, eyebrow, plainCard } from "./shared";

type Block = Extract<LessonBlock, { type: "personaDecision" }>;

/**
 * Design J: a trade-off with no single right answer. Choosing reveals the consequence; another choice can be tried
 * at once. Not graded, so Continue never waits for it and nothing is saved.
 */
export function PersonaDecision({ block }: { block: Block }) {
  const [choice, setChoice] = useState<string>();
  const option = block.options.find((item) => item.id === choice);
  const { persona } = block;
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-start lg:gap-7">
    <div className="flex min-w-0 flex-col gap-4">
      <section aria-labelledby={`${block.id}-persona`} className={cn(plainCard, "flex flex-col gap-3 p-4 md:p-5")}>
        <div className="flex items-center gap-3">
          <span className="relative size-14 shrink-0 overflow-hidden rounded-full border border-border bg-surface-sunken">
            <Image src="/investi-assets/guide/02-thinking.webp" alt="" width={112} height={112} className="absolute -top-1 left-0 size-[72px] max-w-none object-cover object-top" />
          </span>
          <div className="min-w-0">
            <h3 id={`${block.id}-persona`} className="text-[17px]/6 font-semibold text-foreground">{persona.name}, {persona.age} let</h3>
            <p className="text-sm/5 text-secondary">{persona.need}</p>
          </div>
        </div>
        <dl className="flex flex-col gap-1.5">{persona.facts.map((fact) => <div key={fact.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-baseline gap-x-3 gap-y-0.5 rounded-md bg-surface-sunken px-3 py-2.5">
          <dt className="text-sm/5 text-secondary">{fact.label}</dt><dd className="min-w-0 text-right text-[15px] font-semibold tabular-nums text-foreground [overflow-wrap:anywhere]">{fact.value}</dd>
          {fact.detail ? <dd className="col-span-2 flex items-center gap-1.5 text-[13px]/[19px] text-muted"><Info aria-hidden="true" className="size-3.5 shrink-0" />{fact.detail}</dd> : null}
        </div>)}</dl>
      </section>
      {block.note ? <aside aria-label={block.note.title} className="flex flex-col gap-1 rounded-control bg-surface-muted px-4 py-3">
        <p className="text-sm font-semibold text-primary">{block.note.title}</p>
        <p className="text-sm/[21px] text-secondary">{block.note.content}</p>
      </aside> : null}
    </div>
    <section aria-labelledby={`${block.id}-prompt`} className={plainCard}>
      <div className="flex flex-col gap-3 p-[18px] md:px-6 md:py-5">
        <p className={cn(eyebrow, "text-primary")}>Tvoje rozhodnutí</p>
        <h3 id={`${block.id}-prompt`} className={cardTitle}>{block.prompt}</h3>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{block.prompt}</legend>
          {block.options.map((item, index) => <AnswerChoice key={item.id} name={block.id} value={item.id} letter={String.fromCharCode(65 + index)} checked={choice === item.id} state={choice === item.id ? "selected" : "idle"} onChange={setChoice}>{item.label}</AnswerChoice>)}
        </fieldset>
      </div>
      <div role="status" aria-live="polite">
        {option ? <div className="flex flex-col gap-3 border-t border-divider bg-surface-sunken px-[18px] pt-4 pb-5 md:px-6">
          <h4 className="flex items-center gap-2 text-[19px]/6 font-semibold tracking-[-0.3px] text-foreground"><Scale aria-hidden="true" className="size-5 shrink-0 text-primary" />{option.consequence.lead}</h4>
          <p className="text-[15px]/[23px] text-foreground">{option.consequence.content}</p>
          <dl className="flex flex-col gap-1">{option.consequence.rows.map((row) => <div key={row.label} className="flex items-baseline justify-between gap-3 rounded-md bg-surface px-3 py-2">
            <dt className="text-sm/5 text-secondary">{row.label}</dt><dd className="shrink-0 text-right text-[15px] font-semibold tabular-nums text-foreground">{row.value}</dd>
          </div>)}</dl>
          <button type="button" onClick={() => setChoice(undefined)} className="inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-primary-hover underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"><RotateCcw aria-hidden="true" className="size-4" />Zkusit jinou volbu</button>
          {block.disclaimer ? <p className="text-[13px]/[19px] text-muted">{block.disclaimer}</p> : null}
        </div> : null}
      </div>
    </section>
  </div>;
}
