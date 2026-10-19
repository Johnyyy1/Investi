export const VOLATILITY_MODULE_ID = "module-volatility";

export const volatilityLessons = [
  { id: "volatility-what-is-volatility", slug: "what-is-volatility", title: "Co je volatilita", summary: "Rozliš riziko, kolísání a směr pohybu ceny.", estimatedMinutes: 10, status: "available" as const },
  { id: "volatility-standard-deviation", slug: "standard-deviation", title: "Směrodatná odchylka výnosů", summary: "Změř, jak daleko se výnosy rozptylují kolem průměru.", estimatedMinutes: 12, status: "available" as const },
  { id: "volatility-annualising", slug: "annualising-volatility", title: "Anualizace volatility", summary: "Převeď denní nebo měsíční kolísání na roční pomocí odmocniny času.", estimatedMinutes: 11, status: "available" as const },
  { id: "volatility-max-drawdown", slug: "max-drawdown", title: "Největší propad a zotavení", summary: "Najdi nejhlubší pokles od vrcholu a spočítej, kolik stojí návrat.", estimatedMinutes: 12, status: "available" as const },
  { id: "volatility-checkpoint", slug: "volatility-checkpoint", title: "Kontrola: volatilita a propad", summary: "Propoj směrodatnou odchylku, anualizaci a propad v jednom ověření.", estimatedMinutes: 10, status: "available" as const },
] as const;

/** Lab metrics link to the lesson that explains them. */
export const volatilityLessonLinks = {
  volatility: { href: `/learn/volatility/${volatilityLessons[0].slug}`, label: `Lekce: ${volatilityLessons[0].title}` },
  maxDrawdown: { href: `/learn/volatility/${volatilityLessons[3].slug}`, label: `Lekce: ${volatilityLessons[3].title}` },
} as const;
