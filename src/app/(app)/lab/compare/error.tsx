"use client";

import { RouteState } from "@/components/route-state/route-state";

/** No zeros, no stale prices, no technical detail. */
export default function CompareError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteState alert eyebrow="Portfolio Lab" title="Srovnání se teď nenačetlo"
    action={{ onClick: () => retry(), label: "Načíst znovu" }} link={{ href: "/lab/portfolio", label: "Zpět do Portfolio Labu" }}>
    Tvoje portfolio zůstává beze změny, jen teď neumíme zobrazit data instrumentů. Proto tu nejsou žádné ceny.
  </RouteState>;
}
