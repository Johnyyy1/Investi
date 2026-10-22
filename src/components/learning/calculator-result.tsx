import type { ReactNode } from "react";

/** One result region per calculator. Keep the unrounded model separate from display formatting. */
export function CalculatorResult({ children, label = "Výsledek výpočtu" }: { children: ReactNode; label?: string }) {
  return <section aria-label={label} aria-live="polite" aria-atomic="true" className="grid min-w-0 gap-6 border-y border-border py-6 sm:grid-cols-2 [&_p]:[overflow-wrap:anywhere]">{children}</section>;
}
