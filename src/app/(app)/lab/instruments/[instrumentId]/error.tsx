"use client";

import { RouteState } from "@/components/route-state/route-state";

/** No zeros, no stale prices, no technical detail. */
export default function InstrumentError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteState alert eyebrow="Portfolio Lab" title="Detail instrumentu se teď nenačetl"
    action={{ onClick: () => retry(), label: "Načíst znovu" }} link={{ href: "/lab/portfolio", label: "Zpět do Portfolio Labu" }}>
    Tvoje portfolio zůstává beze změny, jen teď neumíme zobrazit data instrumentu. Proto tu nejsou žádné ceny.
  </RouteState>;
}
