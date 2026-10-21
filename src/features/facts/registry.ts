/**
 * Dated fact registry: changing tax, regulatory and research values live here, never in lesson prose.
 * Minimal first slice of #132 used by the `factNotice` lesson block. A fact that has not been checked against a
 * primary source stays `pending`; lessons show that state calmly instead of presenting the value as settled.
 */
export type Fact = {
  key: string;
  /** Learner-facing name of the value. */
  label: string;
  /** Display value in Czech notation, including the unit. */
  value: string;
  jurisdiction: "CZ" | "EU";
  legalBasis?: string;
  /** ISO date from which the rule applies. */
  effectiveFrom: string;
  effectiveTo?: string;
  source: { label: string; url: string };
  /** ISO date of the last check of this value. */
  verifiedAt: string;
  /** `verified` only after a check against a primary source. */
  status: "verified" | "pending";
  owner: string;
  nextReviewAt: string;
  note?: string;
};

const registry = {
  "cz.tax.securities.time_test": {
    key: "cz.tax.securities.time_test",
    label: "Časový test",
    value: "více než 3 roky",
    jurisdiction: "CZ",
    legalBasis: "§ 4 odst. 1 zákona č. 586/1992 Sb., o daních z příjmů",
    effectiveFrom: "2014-01-01",
    source: { label: "Portál POHODA · zdanění příjmů z prodeje cenných papírů", url: "https://portal.pohoda.cz/zakon-a-pravo/finance-a-dane/zdaneni-prijmu-z-prodeje-cennych-papiru/" },
    verifiedAt: "2026-10-20",
    status: "pending",
    owner: "redakce Investníku",
    nextReviewAt: "2027-01-15",
    note: "Sekundární zdroj; čeká na ověření v e-Sbírce a odbornou revizi.",
  },
  "cz.tax.securities.value_test": {
    key: "cz.tax.securities.value_test",
    label: "Hodnotový test",
    value: "100 000 Kč za rok",
    jurisdiction: "CZ",
    legalBasis: "§ 4 odst. 1 zákona č. 586/1992 Sb., o daních z příjmů",
    effectiveFrom: "2014-01-01",
    source: { label: "Portál POHODA · zdanění příjmů z prodeje cenných papírů", url: "https://portal.pohoda.cz/zakon-a-pravo/finance-a-dane/zdaneni-prijmu-z-prodeje-cennych-papiru/" },
    verifiedAt: "2026-10-20",
    status: "pending",
    owner: "redakce Investníku",
    nextReviewAt: "2027-01-15",
    note: "Testuje se úhrn příjmů z prodeje za rok, ne zisk. Sekundární zdroj; čeká na ověření.",
  },
} as const satisfies Record<string, Fact>;

export type FactKey = keyof typeof registry;

export function getFact(key: FactKey): Fact {
  return registry[key];
}

/** "Stav k" of a lesson: the oldest check among its facts, and whether any of them still waits for verification. */
export function factsState(keys: readonly FactKey[]) {
  const facts = keys.map(getFact);
  if (!facts.length) return undefined;
  const asOf = facts.map((fact) => fact.verifiedAt).sort()[0];
  return { facts, asOf, pending: facts.some((fact) => fact.status === "pending"), sources: [...new Map(facts.map((fact) => [fact.source.url, fact.source])).values()] };
}

/** 2026-10-20 → 20. 10. 2026 */
export function formatFactDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day}. ${month}. ${year}`;
}
