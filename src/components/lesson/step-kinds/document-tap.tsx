"use client";

import type { ReactNode } from "react";
import { Check, CircleAlert, CircleCheck, CircleMinus, FileText, ListChecks, Minus } from "lucide-react";
import type { DocumentRow, LessonBlock } from "@/features/lessons/types";
import { parseSelection, serializeSelection } from "@/features/lessons/question-evaluation";
import { cn } from "@/lib/utils";
import { cardTitle, eyebrow, plainCard, questionCard } from "./shared";

type Block = Extract<LessonBlock, { type: "documentTap" }>;
export type RowStatus = "correct" | "missed" | "extra" | "neutral";

/** Evaluated state of one row: never colour alone, every status also has an icon and a word. */
export function documentRowStatus(block: Block, row: DocumentRow, selected: readonly string[]): RowStatus {
  const shouldSelect = block.correctRowIds.includes(row.id);
  const isSelected = selected.includes(row.id);
  return shouldSelect ? isSelected ? "correct" : "missed" : isSelected ? "extra" : "neutral";
}
export function documentSummary(block: Block, selected: readonly string[]) {
  const missed = block.correctRowIds.filter((id) => !selected.includes(id)).length;
  const extra = selected.filter((id) => !block.correctRowIds.includes(id)).length;
  return [missed ? `chybí: ${missed}` : "", extra ? `navíc: ${extra}` : ""].filter(Boolean).join(" · ");
}

const statusStyle: Record<RowStatus, { row: string; text: string; icon: ReactNode; label: string }> = {
  correct: { row: "bg-primary-soft", text: "text-primary", icon: <CircleCheck aria-hidden="true" className="size-3.5 shrink-0" />, label: "Správně" },
  missed: { row: "bg-warning-soft", text: "text-warning-ink", icon: <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />, label: "Chybí" },
  extra: { row: "bg-surface-muted", text: "text-secondary", icon: <CircleMinus aria-hidden="true" className="size-3.5 shrink-0" />, label: "Navíc" },
  neutral: { row: "", text: "text-muted", icon: <Minus aria-hidden="true" className="size-3.5 shrink-0" />, label: "Správně neoznačeno" },
};

/** Design H: the learner marks rows directly in a fictional document. From 1280 px: full table left, task right (sticky); narrower screens stack row cards. */
export function DocumentTap({ block, answers, verdict, mastery, onAnswer, feedback }: {
  block: Block; answers: Record<string, string>; verdict?: boolean; mastery: boolean; onAnswer: (id: string, value: string) => void; feedback: ReactNode;
}) {
  const checked = verdict !== undefined;
  const selected = parseSelection(answers.selected);
  const { document } = block;
  const role = (name: NonNullable<Block["document"]["columns"][number]["mobile"]>) => document.columns.filter((column) => column.mobile === name);
  function toggle(id: string) {
    onAnswer("selected", serializeSelection(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]));
  }
  function status(row: DocumentRow) {
    return checked ? documentRowStatus(block, row, selected) : undefined;
  }
  return <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] xl:items-start xl:gap-7">
    <section aria-labelledby={`${block.id}-document`} className={cn(plainCard, "min-w-0")}>
      <header className="flex flex-col gap-1 border-b border-divider bg-surface-sunken px-4 py-3.5 md:px-5">
        <p className={cn(eyebrow, "flex items-center gap-1.5 text-muted")}><FileText aria-hidden="true" className="size-3.5" />{document.eyebrow}</p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <h3 id={`${block.id}-document`} className="text-[17px]/6 font-semibold text-foreground">{document.title}</h3>
          {document.period ? <p className="hidden text-sm text-secondary xl:block">{document.period}</p> : null}
        </div>
        <p className="text-[13px]/[19px] text-secondary">{document.meta}{document.period ? <span className="xl:hidden"> · {document.period}</span> : null}</p>
      </header>
      <fieldset disabled={checked} className="min-w-0">
        <legend className="sr-only">{block.prompt}</legend>
        <ul className="flex flex-col xl:hidden">
          <li aria-hidden="true" className="flex justify-between border-b border-divider px-4 py-2 text-xs font-semibold text-muted"><span className="pl-10">{[...role("title"), ...role("subtitle")].map((column) => column.label).join(" · ")}</span><span>{role("value").map((column) => column.label).join(" · ")}</span></li>
          {document.rows.map((row) => <MobileRow key={row.id} block={block} row={row} selected={selected.includes(row.id)} status={status(row)} onToggle={() => toggle(row.id)} />)}
        </ul>
        <div className="hidden overflow-x-auto xl:block"><table className="w-full border-collapse text-left">
          <thead><tr className="border-b border-divider text-xs font-semibold tracking-[0.6px] text-muted uppercase">
            <th scope="col" className="w-14 py-3 pl-5"><span className="sr-only">Označit</span></th>
            {document.columns.map((column) => <th key={column.id} scope="col" className={cn("px-3 py-3 font-semibold", column.align === "end" && "text-right")}>{column.label}</th>)}
          </tr></thead>
          <tbody>{document.rows.map((row) => {
            const rowStatus = status(row);
            return [
              <tr key={row.id} className={cn("border-t border-divider first:border-t-0", rowStatus ? statusStyle[rowStatus].row : selected.includes(row.id) && "bg-surface-practice")}>
                <td className="py-3 pl-5 align-top">{row.selectable === false ? null : <RowCheckbox id={`${block.id}-${row.id}-wide`} label={rowLabel(block, row)} checked={selected.includes(row.id)} status={rowStatus} onToggle={() => toggle(row.id)} />}</td>
                {document.columns.map((column, index) => <td key={column.id} className={cn("px-3 pt-4 pb-1 align-top text-[15px] whitespace-nowrap tabular-nums", index === 0 ? "font-semibold text-foreground" : "text-secondary", column.align === "end" && "text-right")}>{row.cells[column.id]}</td>)}
              </tr>,
              rowStatus ? <tr key={`${row.id}-note`} className={statusStyle[rowStatus].row}><td /><td colSpan={document.columns.length} className="px-3 pb-3"><RowNote row={row} status={rowStatus} /></td></tr> : null,
            ];
          })}</tbody>
        </table></div>
      </fieldset>
    </section>
    <section aria-labelledby={`${block.id}-task`} aria-describedby={checked ? `${block.id}-feedback` : undefined} className={questionCard(mastery, "xl:sticky xl:top-6")}>
      <div className="flex flex-col gap-2.5 p-[18px] md:px-6 md:py-5">
        <p className={cn(eyebrow, "text-primary")}>Úkol</p>
        <h3 id={`${block.id}-task`} className={cardTitle}>{block.prompt}</h3>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-secondary"><ListChecks aria-hidden="true" className="size-4" />Označeno: {selected.length}{checked ? " · vyhodnoceno" : ""}</p>
      </div>
      {feedback}
    </section>
  </div>;
}

function rowLabel(block: Block, row: DocumentRow) {
  return block.document.columns.map((column) => row.cells[column.id]).filter(Boolean).join(", ");
}

function MobileRow({ block, row, selected, status, onToggle }: { block: Block; row: DocumentRow; selected: boolean; status?: RowStatus; onToggle: () => void }) {
  // "10 ks", "× 61,20" → "10 ks × 61,20": a labelled cell continues the previous one, others are separated by a dot.
  const cells = (name: string) => block.document.columns.filter((column) => column.mobile === name && row.cells[column.id])
    .map((column, index) => column.mobileLabel ? `${index ? " " : ""}${column.mobileLabel} ${row.cells[column.id]}` : `${index ? " · " : ""}${row.cells[column.id]}`);
  return <li className={cn("flex gap-3 border-t border-divider px-4 py-3 first:border-t-0", status ? statusStyle[status].row : selected && "bg-surface-practice")}>
    <div className="pt-0.5">{row.selectable === false ? <span className="block size-7" /> : <RowCheckbox id={`${block.id}-${row.id}`} label={rowLabel(block, row)} checked={selected} status={status} onToggle={onToggle} />}</div>
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex justify-between gap-3">
        <div className="min-w-0"><p className="text-[15px]/5 font-semibold text-foreground">{cells("title").join("")}</p><p className="text-sm/5 text-secondary">{cells("subtitle").join("")}</p></div>
        <div className="shrink-0 text-right"><p className="text-[15px]/5 tabular-nums text-foreground">{cells("value").join("")}</p><p className="text-[13px]/5 tabular-nums text-muted">{cells("detail").join("")}</p></div>
      </div>
      {status ? <RowNote row={row} status={status} /> : null}
    </div>
  </li>;
}

function RowNote({ row, status }: { row: DocumentRow; status: RowStatus }) {
  const style = statusStyle[status];
  return <p className={cn("flex items-center gap-1.5 text-[13px]/[19px] font-semibold", style.text)}>{style.icon}<span>{row.selectable === false ? row.note : `${style.label} · ${row.note}`}</span></p>;
}

/** Native checkbox over a 28 px visual box inside a 44 px hit area. */
function RowCheckbox({ id, label, checked, status, onToggle }: { id: string; label: string; checked: boolean; status?: RowStatus; onToggle: () => void }) {
  const box = status === "extra" ? "border-secondary bg-secondary text-surface" : status === "missed" ? "border-warning-ink bg-surface" : checked ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-surface";
  return <label htmlFor={id} className="relative -m-2 flex size-11 cursor-pointer items-center justify-center has-[:disabled]:cursor-default has-[:focus-visible]:rounded-control has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-foreground">
    <input id={id} type="checkbox" checked={checked} onChange={onToggle} aria-label={`Označit řádek: ${label}`} className="absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-default" />
    <span aria-hidden="true" className={cn("flex size-7 items-center justify-center rounded-[7px] border-2", box)}>{checked ? <Check className="size-4" strokeWidth={3} /> : null}</span>
  </label>;
}
