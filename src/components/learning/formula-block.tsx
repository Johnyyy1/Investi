import katex from "katex";
import type { ReactNode } from "react";

export function FormulaBlock({ formula, variables = [], explanation }: {
  formula: string; variables?: { symbol: string; meaning: string }[]; explanation?: ReactNode;
}) {
  let html: string;
  try {
    html = katex.renderToString(formula, { displayMode: true, output: "htmlAndMathml", throwOnError: true, trust: false, strict: "error" });
  } catch {
    return <figure className="rounded-surface border border-border bg-surface p-6"><p role="status" className="text-small text-danger-ink">Tento vzorec se nepodařilo zobrazit.</p><code className="break-all text-small">{formula}</code></figure>;
  }
  return <figure className="rounded-surface border border-border bg-surface p-4 min-[375px]:p-5 sm:p-6">
    <div className="py-2 text-center" dangerouslySetInnerHTML={{ __html: html }} />
    {variables.length ? <dl className="mt-4 grid gap-4 min-[420px]:grid-cols-3">{variables.map(({ symbol, meaning }) => <div key={symbol} className="min-w-0"><dt className="text-small font-semibold">{symbol}</dt><dd lang="cs" className="mt-1 break-normal [overflow-wrap:normal] text-small text-secondary">{meaning}</dd></div>)}</dl> : null}
    {explanation ? <figcaption className="mt-4 text-small text-secondary">{explanation}</figcaption> : null}
  </figure>;
}
