import type { ArtifactKind, ArtifactPayload } from "./schemas";

const goal = { label: "Dlouhodobý plán", purpose: "retirement", horizonMonths: 360, priority: "important" } as const;
export const artifactExamples = {
  goal_map: { goals: [goal] },
  financial_checkup: { budget: "reviewed", expensiveDebt: "none", reserve: "building", nextStep: "build_reserve" },
  fee_profile: { label: "Fiktivní broker A", currency: "EUR", orderFeeMinor: "25", minimumOrderFeeMinor: "100", orderFeeBasisPoints: 10, fxSpreadBasisPoints: 50, monthlyFeeMinor: "0" },
  etf_checklist: { instrument: "Ukázkové světové ETF", ucits: "yes", kidReviewed: true, costsReviewed: true, diversificationReviewed: true, rationale: "Široké pokrytí odpovídá mému cíli." },
  safeguards: { rules: [{ trigger: "Pokles trhu", action: "Před rozhodnutím si přečtu svůj plán." }] },
  investment_plan: { goals: [goal], horizonMonths: 360, allocation: [{ assetClass: "equity", weightBasisPoints: 8000 }, { assetClass: "cash", weightBasisPoints: 2000 }], reviewFrequency: "annually", rebalanceRule: "Při roční kontrole podle plánu.", crisisPlan: "Přečtu si původní cíle a ověřím, jestli se změnily." },
  trade_checklist: { items: [{ label: "Odpovídá nákup mému plánu?", checked: true }] },
  business_map: { company: "Modelová firma", customers: ["Domácnosti"], revenueDrivers: ["Předplatné"], advantages: ["Distribuce"], risks: ["Konkurence"] },
  investment_thesis: { company: "Modelová firma", thesis: "Poptávka může růst.", assumptions: ["Stabilní marže"], evidence: ["Modelový výkaz"], risks: ["Pokles poptávky"], exitCriteria: ["Změna obchodního modelu"], reviewOn: "2027-04-21" },
  journal: { entries: [{ date: "2026-10-21", decision: "Držím se plánu.", reasoning: "Cíl a horizont se nezměnily.", nextReviewOn: "2027-04-21" }] },
} satisfies { [K in ArtifactKind]: ArtifactPayload<K> };
