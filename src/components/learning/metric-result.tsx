import type { ReactNode } from "react";
const sentimentColor = { positive: "text-success-ink", negative: "text-danger-ink", neutral: "text-foreground" };
export function MetricResult({ label, value, sentiment = "neutral", note }: {
  label: string; value: ReactNode; sentiment?: keyof typeof sentimentColor; note?: string;
}) {
  return <div className="min-w-0"><p className="text-small text-secondary">{label}</p><p lang="cs" className={`mt-1 break-normal [overflow-wrap:normal] text-section-title font-semibold tabular-nums ${sentimentColor[sentiment]}`}>{value}</p>{note ? <p className="mt-1 text-microcopy text-secondary">{note}</p> : null}</div>;
}
