export const DIVERSIFICATION_MODULE_ID = "module-diversification";

export const diversificationLessons = [
  { id: "diversification-concentration", slug: "concentration", title: "Koncentrace portfolia", summary: "Spočítej váhy pozic a zjisti, jak moc celé portfolio závisí na jedné firmě.", estimatedMinutes: 10, status: "available" as const },
  { id: "diversification-sectors-countries", slug: "sectors-and-countries", title: "Sektory a země", summary: "Odhal koncentraci, kterou počet firem neukáže: v jednom odvětví nebo v jedné zemi.", estimatedMinutes: 10, status: "available" as const },
  { id: "diversification-etf-look-through", slug: "etf-look-through", title: "Co je uvnitř ETF", summary: "Nahlédni do fondů a sečti, kolik máš v jedné firmě doopravdy.", estimatedMinutes: 11, status: "available" as const },
  { id: "diversification-correlation-risk", slug: "correlation-and-portfolio-risk", title: "Korelace a riziko portfolia", summary: "Spočítej, jak korelace mění volatilitu portfolia ze dvou investic.", estimatedMinutes: 12, status: "available" as const },
  { id: "diversification-scenario", slug: "diversification-scenario", title: "Scénář: sestav rozložené portfolio", summary: "Rozděl scénářový kapitál, ověř pravidla a porovnej je s výsledkem scénáře.", estimatedMinutes: 12, status: "available" as const },
] as const;
