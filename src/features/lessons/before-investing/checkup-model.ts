import type { ArtifactPayload } from "@/features/artifacts/schemas";

export const CHECKUP_LESSON_ID = "before-investing-checkup";
export type FinancialCheckup = ArtifactPayload<"financial_checkup">;

/** Advice only: neither these categories nor the declared nextStep grant or revoke access. */
export function checkupNextStep(checkup: Omit<FinancialCheckup, "nextStep">): FinancialCheckup["nextStep"] {
  if (checkup.expensiveDebt === "plan_needed") return "make_debt_plan";
  if (checkup.reserve === "building" || checkup.reserve === "needs_review") return "build_reserve";
  if (checkup.budget !== "reviewed") return "review_budget";
  if (checkup.goals === "needs_review") return "define_goals";
  return "continue_learning";
}

export const checkupAdvice = {
  make_debt_plan: { title: "Nejdřív plán splácení drahého dluhu", body: "Podle odpovědi má přednost plán splácení. Učení může pokračovat; check-up nemění přístup k lekcím ani Labu.", lessonId: "before-investing-debt" },
  build_reserve: { title: "Nejdřív dobudovat nebo prověřit rezervu", body: "Podle odpovědi rezerva ještě potřebuje pozornost. Učit se můžeš už teď; skutečné investování odlož, dokud si neověříš dostatečnou rezervu pro svou situaci.", lessonId: "before-investing-emergency-fund" },
  review_budget: { title: "Prověř pravidelný přebytek", body: "Vrať se k rozpočtu včetně nepravidelných výdajů. Nevyplněná soukromá informace není neúspěch ani důvod zamknout obsah.", lessonId: "before-investing-budget" },
  define_goals: { title: "Upřesni účel a termín peněz", body: "Mapa cílů pomůže rozlišit blízké výdaje a dlouhodobé investování.", lessonId: "before-investing-goals" },
  continue_learning: { title: "Pokračuj v učení", body: "Další krok může vést do Základů investování. Check-up není potvrzení připravenosti investovat skutečné peníze; neznámé podmínky si ještě ověř.", lessonId: "foundations-why-invest" },
} as const;
