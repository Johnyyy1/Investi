import { RouteState } from "@/components/route-state/route-state";

/** Malformed comparison links and identities the market data source does not know. */
export default function CompareNotFound() {
  return <RouteState eyebrow="Portfolio Lab" title="Tohle srovnání jsme nenašli" action={{ href: "/lab/compare", label: "Vybrat instrumenty znovu" }}>
    Odkaz může být neúplný, nebo některý z instrumentů není v nastaveném zdroji tržních dat.
  </RouteState>;
}
