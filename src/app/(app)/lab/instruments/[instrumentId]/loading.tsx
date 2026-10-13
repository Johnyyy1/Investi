import { PageFrame } from "@/components/shell/page-frame";

/** Neutral placeholder: no price, return or chart point is shown until the market data arrives. */
export default function InstrumentLoading() {
  return <PageFrame width="wide" className="max-w-[80rem] pt-6 pb-28 sm:pt-7 sm:pb-10 lg:pt-8">
    <div aria-busy="true" className="min-w-0">
      <p role="status" className="text-small text-secondary">Načítáme detail instrumentu a poslední dostupnou cenu…</p>
      <div aria-hidden="true" className="mt-6 space-y-4">
        <div className="h-4 w-28 rounded-control bg-surface-muted motion-safe:animate-pulse" />
        <div className="h-10 w-3/4 max-w-md rounded-control bg-surface-muted motion-safe:animate-pulse" />
        <div className="h-4 w-56 rounded-control bg-surface-muted motion-safe:animate-pulse" />
      </div>
      <div aria-hidden="true" className="mt-8 h-44 rounded-panel border border-border bg-surface-muted motion-safe:animate-pulse" />
      <div aria-hidden="true" className="mt-6 h-80 rounded-panel border border-border bg-surface-muted motion-safe:animate-pulse" />
      <div aria-hidden="true" className="mt-6 h-56 rounded-panel border border-border bg-surface-muted motion-safe:animate-pulse" />
    </div>
  </PageFrame>;
}
