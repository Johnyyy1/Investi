import { RouteState } from "@/components/route-state/route-state";

/** Malformed instrument links and identities the market data source does not know. */
export default function InstrumentNotFound() {
  return <RouteState eyebrow="Portfolio Lab" title="Tenhle instrument jsme nenašli" action={{ href: "/lab/portfolio", label: "Zpět do Portfolio Labu" }}>
    Odkaz může být neúplný, nebo instrument není v nastaveném zdroji tržních dat. Vyhledej ho v Portfolio Labu.
  </RouteState>;
}
