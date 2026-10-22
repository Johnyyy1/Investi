"use client";

import { useState } from "react";
import { CalendarCheck, ChevronRight, Clock3, Database, Info, Landmark } from "lucide-react";
import { factsState, getFact, isFactPending, type FactKey } from "@/features/facts/registry";
import { formatFactDate, formatFactValue } from "@/features/facts/resolve";
import type { FactVersion } from "@/features/facts/types";
import { cn } from "@/lib/utils";
import { eyebrow, plainCard } from "./shared";

/**
 * Design L: the dated numbers a lesson relies on, plus the educational-content notice.
 * Values always come from the fact registry; an unverified or blocked fact is shown calmly (grey, clock), never as an alarm.
 */
export function FactNotice({ id, factKeys }: { id: string; factKeys: readonly FactKey[] }) {
  const state = factsState(factKeys);
  const [open, setOpen] = useState<string>();
  if (!state) return null;
  const sources = [...new Set(state.sources.map((source) => source.title.split(": ")[0]))].join(", ");
  return <div className="flex flex-col gap-4">
    <section aria-labelledby={`${id}-facts`} className={cn(plainCard, "flex flex-col gap-2 p-4 md:px-5")}>
      <h3 id={`${id}-facts`} className={cn(eyebrow, "flex items-center gap-1.5 text-muted")}><Database aria-hidden="true" className="size-3.5" />Čísla v této lekci</h3>
      <dl className="flex flex-col gap-1.5">{factKeys.map((key) => {
        const fact = getFact(key);
        const expanded = open === key;
        const pending = isFactPending(fact);
        return <div key={key} className="flex flex-wrap items-center justify-between gap-x-3 rounded-md bg-surface-sunken px-3 py-1.5">
          <dt className="min-h-8 flex-1 content-center text-[15px]/5 text-secondary">{fact.label}</dt>
          <dd className="flex items-center gap-1 text-right">
            <span className={cn("text-[17px]/6 font-semibold tabular-nums", pending ? "text-secondary" : "text-foreground")}>{formatFactValue(fact.value)}</span>
            <button type="button" aria-expanded={expanded} aria-controls={`${id}-${key}`} onClick={() => setOpen(expanded ? undefined : key)} className="-mr-2 flex size-9 items-center justify-center rounded-control text-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary">
              {pending ? <Clock3 aria-hidden="true" className="size-4 text-muted" /> : <Database aria-hidden="true" className="size-4" />}
              <span className="sr-only">Původ údaje {fact.label}</span>
            </button>
          </dd>
          {expanded ? <dd id={`${id}-${key}`} className="mt-1 mb-1.5 basis-full rounded-control bg-foreground px-3.5 py-3 text-sm/5 text-surface"><FactOrigin fact={fact} /></dd> : null}
        </div>;
      })}</dl>
    </section>
    <aside aria-labelledby={`${id}-notice`} className="flex flex-col gap-2 rounded-surface border border-border bg-surface-muted px-4 py-4 md:px-5">
      <h3 id={`${id}-notice`} className="flex items-center gap-2 text-base/[22px] font-semibold text-foreground"><Landmark aria-hidden="true" className="size-4 shrink-0" />Vzdělávací obsah, ne daňové poradenství</h3>
      {state.pending ? <>
        <p className="flex w-fit items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-[13px] font-semibold text-secondary"><Clock3 aria-hidden="true" className="size-3.5" />Údaj čeká na ověření</p>
        <p className="text-[15px]/[23px] text-secondary">Naposledy kontrolováno {formatFactDate(state.asOf)} ({sources}). Mezitím kontrolujeme, jestli se pravidlo nezměnilo; text platí k tomuto datu.</p>
      </> : <p className="flex items-center gap-1.5 text-[15px]/[23px] text-secondary"><CalendarCheck aria-hidden="true" className="size-4 shrink-0" />Stav k {formatFactDate(state.asOf)} · Zdroj: {sources}</p>}
      <details className="group">
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 text-[15px] font-semibold text-primary-hover focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">Co když se pravidla změní?<ChevronRight aria-hidden="true" className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none" /></summary>
        <p className="pb-1 text-[15px]/[23px] text-secondary">Daňová pravidla se mění zákonem, obvykle od 1. ledna. Čísla v lekci bereme z jednoho datovaného přehledu a kontrolujeme je podle plánu. Než podle nich něco uděláš, ověř si aktuální stav u Finanční správy nebo u daňového poradce.</p>
      </details>
    </aside>
  </div>;
}

function FactOrigin({ fact }: { fact: FactVersion }) {
  const pending = isFactPending(fact) || !fact.verifiedAt;
  return <>
    <span className="block font-semibold">{pending ? "Čeká na ověření" : `Ověřeno ${formatFactDate(fact.verifiedAt!)}`}</span>
    <span className="block opacity-80">{pending ? `Naposledy kontrolováno ${formatFactDate(fact.checkedAt)} · ` : "Zdroj: "}{fact.sources.map((source, index) => <span key={source.url}>{index ? ", " : ""}<a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{source.title}</a></span>)}{fact.legalBasis ? ` · ${fact.legalBasis}` : ""}</span>
  </>;
}

/** The "Stav k …" chip under a lesson's first step title, when the lesson shows dated facts. */
export function FactStatusChip({ factKeys }: { factKeys: readonly FactKey[] }) {
  const state = factsState(factKeys);
  if (!state) return null;
  return <p className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold text-foreground">
    {state.pending ? <Clock3 aria-hidden="true" className="size-3.5 text-muted" /> : <Landmark aria-hidden="true" className="size-3.5" />}
    {state.pending ? "Údaj čeká na ověření" : `Stav k ${formatFactDate(state.asOf)}`}
    <Info aria-hidden="true" className="size-3.5 text-muted" />
    <span className="sr-only">Vzdělávací obsah, ne daňové poradenství. Čísla jsou z datovaného přehledu faktů.</span>
  </p>;
}
