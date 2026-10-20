import "server-only";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { ReactNode } from "react";
import { metricEntry, type MetricId } from "@/features/learning/metric-glossary";

/** Server-rendered formulas keyed by metric, handed to client views so KaTeX never ships to the browser. */
export type MetricFormulas = Partial<Record<MetricId, ReactNode>>;

export function MetricFormula({ id }: { id: MetricId }) {
  let html: string;
  try {
    html = katex.renderToString(metricEntry(id).formula, { output: "htmlAndMathml", throwOnError: true, trust: false, strict: "error" });
  } catch {
    return null;
  }
  return <p className="mt-2 max-w-full overflow-x-auto text-small text-foreground" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function metricFormulas(ids: readonly MetricId[]): MetricFormulas {
  return Object.fromEntries(ids.map((id) => [id, <MetricFormula key={id} id={id} />]));
}
