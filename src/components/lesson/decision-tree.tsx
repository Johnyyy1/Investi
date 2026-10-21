"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LessonBlock } from "@/features/lessons/types";
import { resolveDecisionTree } from "@/features/lessons/decision-tree";

export function DecisionTree({ block }: { block: Extract<LessonBlock, { type: "decisionTree" }> }) {
  const [path, setPath] = useState<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const node = resolveDecisionTree(block, path);
  function move(next: string[]) {
    setPath(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  return <section aria-labelledby={`${block.id}-tree`} className="space-y-4 break-words rounded-surface border border-border bg-surface p-5 md:p-7">
    <h3 id={`${block.id}-tree`} className="text-xl font-semibold">{block.title}</h3>
    <p className="text-sm text-secondary">Průvodce bez hodnocení. Můžeš prozkoumat i jiné možnosti.</p>
    <h4 ref={heading} tabIndex={-1} className="font-semibold">{node ? "prompt" in node ? node.prompt : "Výsledek" : "Tuto větev se nepodařilo zobrazit."}</h4>
    {node && "choices" in node ? <div className="flex flex-col items-start gap-3">{node.choices.map((choice) => <Button key={choice.id} variant="secondary" className="h-auto min-h-12 max-w-full whitespace-normal text-left" onClick={() => move([...path, choice.id])}>{choice.label}</Button>)}</div> : node && <p role="status" className="text-foreground">{node.outcome}</p>}
    {path.length > 0 && <div className="flex flex-wrap gap-3"><Button variant="ghost" onClick={() => move(path.slice(0, -1))}>Zpět o rozhodnutí</Button><Button variant="ghost" onClick={() => move([])}>Začít znovu</Button></div>}
  </section>;
}
