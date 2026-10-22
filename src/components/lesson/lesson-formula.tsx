"use client";

import katex from "katex";
import { Sigma } from "lucide-react";
import { cn } from "@/lib/utils";

const eyebrow = "text-[11px] font-semibold tracking-[0.9px] uppercase md:text-xs md:tracking-[1px]";

/** KaTeX is large, so formula blocks load it on demand (see lazy-blocks.tsx); the stylesheet stays with GuidedBlock. */
export function Formula({ latex, variables }: { latex: string; variables: { symbol: string; description: string }[] }) {
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
