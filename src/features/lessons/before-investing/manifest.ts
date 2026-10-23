export const BEFORE_INVESTING_MODULE_ID = "module-before-investing";

export const beforeInvestingLessons = [
  { id: "before-investing-budget", slug: "budget", title: "Kolik ti zbývá: rozpočet a míra úspor", summary: "Započítej i roční platby a zjisti, kolik můžeš pravidelně odkládat.", estimatedMinutes: 12, status: "available" as const },
  { id: "before-investing-emergency-fund", slug: "emergency-fund", title: "Rezerva: kolik a kde", summary: "Odhadni cíl rezervy, prověř dostupnost a spočítej kupní sílu po dani.", estimatedMinutes: 12, status: "planned" as const },
] as const;
