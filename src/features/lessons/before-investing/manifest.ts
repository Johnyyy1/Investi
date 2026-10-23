export const BEFORE_INVESTING_MODULE_ID = "module-before-investing";

export const beforeInvestingLessons = [
  { id: "before-investing-budget", slug: "budget", title: "Kolik ti zbývá: rozpočet a míra úspor", summary: "Započítej i roční platby a zjisti, kolik můžeš pravidelně odkládat.", estimatedMinutes: 12, status: "available" as const },
  { id: "before-investing-debt", slug: "debt-or-invest", title: "Dluh, nebo investice?", summary: "Porovnej cenu dluhu s nejistým výnosem a stanov pořadí splácení.", estimatedMinutes: 12, status: "available" as const },
  { id: "before-investing-emergency-fund", slug: "emergency-fund", title: "Rezerva: kolik a kde", summary: "Odhadni cíl rezervy, prověř dostupnost a spočítej kupní sílu po dani.", estimatedMinutes: 12, status: "planned" as const },
  { id: "before-investing-goals", slug: "goals-and-horizon", title: "Cíle a investiční horizont", summary: "Rozděl cíle podle termínu a pevnosti a sestav vlastní mapu pro investiční plán.", estimatedMinutes: 11, status: "available" as const },
  { id: "before-investing-retirement-products", slug: "pension-and-dip", title: "Penzijko a DIP: kolik ti přidá stát", summary: "Spočítej státní příspěvek, odpočet a úsporu na dani a zvaž cenu vázaných peněz.", estimatedMinutes: 13, status: "planned" as const },
  { id: "before-investing-scams", slug: "scams-and-finfluencers", title: "Podvody, slibované výnosy a finfluenceři", summary: "Rozpoznej nátlak, prověř poskytovatele a zvol bezpečný postup při podezření na podvod.", estimatedMinutes: 12, status: "planned" as const },
  { id: "before-investing-checkup", slug: "financial-checkup", title: "Finanční check-up", summary: "Prověř finanční základ, procvič souvislosti a zvol další krok bez zamykání obsahu.", estimatedMinutes: 8, status: "available" as const },
] as const;
