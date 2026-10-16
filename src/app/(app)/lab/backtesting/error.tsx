"use client";

import { RouteState } from "@/components/route-state/route-state";

/** No partial metrics or chart: a failed backtest view shows nothing it cannot back up. */
export default function BacktestingError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteState alert eyebrow="Backtesting Lab" title="Backtesting Lab se teď nenačetl"
    action={{ onClick: () => retry(), label: "Načíst znovu" }} link={{ href: "/lab", label: "Zpět do Labu" }}>
    Zkus ho načíst znovu. Tvoje portfolio ani pokrok v učení se tím nezmění.
  </RouteState>;
}
