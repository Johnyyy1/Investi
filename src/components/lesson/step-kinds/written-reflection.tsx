"use client";

import { useId, useState } from "react";
import { Check, Eye, PenLine } from "lucide-react";
import type { LessonBlock } from "@/features/lessons/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cardTitle, countSentences, eyebrow, plainCard } from "./shared";

type Block = Extract<LessonBlock, { type: "writtenReflection" }>;

/**
 * Design M: turn the rule into the learner's own plan. No points and no right/wrong: after sending, the learner
 * compares with a sample answer and ticks what their answer covers. Optional, and kept only in this page for now.
 */
export function WrittenReflection({ block }: { block: Block }) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  const fieldId = useId();
  const sentences = countSentences(text);
  return <div className="flex flex-col gap-5">
    <section aria-labelledby={`${block.id}-prompt`} className={plainCard}>
      <div className="flex flex-col gap-3 p-[18px] md:px-7 md:py-6">
        <p className={cn(eyebrow, "flex items-center gap-1.5 text-primary")}><PenLine aria-hidden="true" className="size-3.5" />Napiš 2–4 věty</p>
        <h3 id={`${block.id}-prompt`} className={cardTitle}>{block.prompt}</h3>
        {submitted ? <div className="flex flex-col gap-2 rounded-control bg-surface-sunken px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className={cn(eyebrow, "text-muted")}>Tvoje odpověď</p>
            <button type="button" onClick={() => setSubmitted(false)} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-hover focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"><PenLine aria-hidden="true" className="size-3.5" />Upravit</button>
          </div>
          <p className="whitespace-pre-line text-[15px]/[23px] text-foreground">{text}</p>
        </div> : <div className="flex flex-col gap-1.5">
          <label htmlFor={fieldId} className="text-sm font-semibold text-foreground">Tvoje odpověď</label>
          <textarea id={fieldId} rows={4} value={text} onChange={(event) => setText(event.target.value)} aria-describedby={`${fieldId}-hint`} placeholder="Napiš to vlastními slovy…" className="min-h-28 w-full resize-y rounded-control border border-border-strong bg-surface px-3.5 py-3 text-base/6 text-foreground placeholder:text-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[0.5px] focus-visible:ring-primary" />
          <p id={`${fieldId}-hint`} className="text-[13px]/[19px] text-muted">{text.trim() ? `Asi ${sentences} ${sentences === 1 ? "věta" : sentences < 5 ? "věty" : "vět"}. ` : ""}Nehodnotí se. Odpověď se zatím nikam neukládá.</p>
          <Button variant="secondary" size="compact" disabled={!text.trim()} onClick={() => setSubmitted(true)} className="mt-1 w-fit">Odeslat a porovnat</Button>
        </div>}
      </div>
    </section>
    <section aria-labelledby={`${block.id}-rubric`} className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`${block.id}-rubric`} className="text-[17px]/6 font-semibold text-foreground">{submitted ? "Co v tvé odpovědi je?" : "Na co myslet"}</h3>
        {submitted ? <p className="text-[13px] text-muted">vidíš jen ty</p> : null}
      </div>
      {submitted ? <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Zaškrtni, co tvoje odpověď obsahuje</legend>
        {block.rubric.map((item) => {
          const checked = ticked.includes(item.id);
          return <label key={item.id} className={cn("relative flex min-h-[52px] cursor-pointer items-center gap-3 rounded-control border px-3.5 py-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground", checked ? "border-primary/40 bg-primary-soft" : "border-border bg-surface")}>
            <input type="checkbox" checked={checked} onChange={() => setTicked((current) => checked ? current.filter((id) => id !== item.id) : [...current, item.id])} className="absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0" />
            <span aria-hidden="true" className={cn("flex size-6 shrink-0 items-center justify-center rounded-[6px] border-2", checked ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-surface")}>{checked ? <Check className="size-3.5" strokeWidth={3} /> : null}</span>
            <span className="text-[15px]/[22px] text-foreground">{item.text}</span>
          </label>;
        })}
      </fieldset> : <ul className="flex flex-col gap-1.5">{block.rubric.map((item) => <li key={item.id} className="flex items-start gap-2.5 text-[15px]/[22px] text-secondary"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-border-strong" />{item.text}</li>)}</ul>}
    </section>
    {submitted ? <aside aria-label="Ukázková odpověď" className="flex flex-col gap-2 rounded-surface border border-border bg-surface-muted px-[18px] py-4">
      <p className={cn(eyebrow, "flex items-center gap-1.5 text-muted")}><Eye aria-hidden="true" className="size-3.5" />Ukázková odpověď</p>
      <p className="text-[15px]/[23px] text-foreground">{block.sampleAnswer}</p>
      <p className="text-[13px]/[19px] text-muted">Není jediná správná. Slouží k porovnání, ne k hodnocení.</p>
    </aside> : null}
  </div>;
}
