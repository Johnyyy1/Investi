import { availableLessons, getModuleBySlug } from "@/features/learning/catalog";
import type { PersonalizedPreferences } from "./profile";
import type { LearningRecommendation, ReasonCode } from "./recommendation";

export const goalLabels = {
  CONFIDENCE: "Začít investovat od základů",
  LONG_TERM_ETF: "Dlouhodobě investovat přes ETF",
  COMPANIES: "Umět analyzovat jednotlivé akcie",
  PORTFOLIO: "Lépe řídit vlastní portfolio",
  QUANT: "Pracovat s daty a kvantitativními metodami",
} satisfies Record<NonNullable<PersonalizedPreferences["primaryGoal"]>, string>;
export const interestLabels = {
  STOCKS: "Akcie", ETFS: "ETF", PORTFOLIO: "Portfolio", FUNDAMENTALS: "Firemní analýza",
  DATA: "Data a statistika", QUANT: "Kvantitativní finance", BACKTESTING: "Backtesting",
} satisfies Record<PersonalizedPreferences["interests"][number], string>;
export const experienceLabels = {
  BEGINNER: "Začínám od nuly", BASIC: "Znám základní pojmy", INVESTOR: "Už investuji a chci jít víc do hloubky",
} satisfies Record<PersonalizedPreferences["selfAssessedExperience"], string>;
export const sessionLabels = { 5: "5 minut", 10: "10 minut", 20: "15–20 minut", 30: "30+ minut" };
export const questionTitles = ["Co se chceš naučit?", "Co tě zajímá nejvíc?", "Jaké máš zkušenosti s investováním?", "Kolik času chceš učení běžně věnovat?"];
export const reasonLabels: Record<ReasonCode, string> = {
  FOUNDATIONS_START: "Začínáš od základů, proto doporučujeme první lekci.",
  FOUNDATIONS_CONTINUE: "Pokračujeme v Základech tam, kde to máš rozdělané.",
  DIAGNOSTIC_REMEDIATION: "Diagnostika ukázala několik základů, které se vyplatí procvičit.",
  FOUNDATIONS_COMPACT_REVIEW: "Základní pojmy ovládáš dobře. Můžeš postupovat svižněji, všechny lekce ale stále dokončíš.",
  RETURNS_AFTER_FOUNDATIONS: "Po Základech je dalším krokem práce s výnosy.",
  RETURNS_FOR_ETF_PATH: "Výnosy jsou základem pro porovnávání výkonnosti ETF.",
  RETURNS_FOR_STOCK_PATH: "Práce s výnosy ti pomůže porovnávat investice do jednotlivých firem.",
  RETURNS_FOR_PORTFOLIO_PATH: "Výnosy jsou dalším krokem k pochopení výsledků vlastního portfolia.",
  RETURNS_FOR_QUANT_PATH: "Výnosy tvoří základ pro pozdější práci s daty a analýzu rizika.",
  VOLATILITY_AFTER_RETURNS: "Výnosy máš hotové. Dalším krokem je měřit, jak moc kolísají.",
  CURRICULUM_COMPLETE: "Všechny dostupné lekce máš hotové. Kdykoli se k nim můžeš vrátit.",
  NO_AVAILABLE_LESSON: "Doporučení teď není dostupné. Prohlédni si celé učení nebo stránku načti znovu.",
};
export const scaffoldLabels = {
  guided: "Dopřej si čas na vysvětlení a procvičení každého kroku.",
  standard: "Procházej lekce vlastním tempem a zkoušej jednotlivé úlohy.",
  compact: "Známá vysvětlení můžeš číst svižněji. Všechny úlohy a ověření zůstávají součástí lekce.",
};
export const contextLabels = {
  neutral: "Postupně propojíš pojmy s vlastními investičními rozhodnutími.",
  etf: "Základy později využiješ při porovnávání ETF.",
  stock: "Základy později využiješ při analýze jednotlivých akcií.",
  portfolio: "Základy později propojíš se složením a výsledky portfolia.",
  data: "Základy později propojíš s daty, statistikou a backtestingem.",
};
export function presentRecommendation(recommendation: LearningRecommendation) {
  const lesson = availableLessons.find(({ id }) => id === recommendation.nextLessonId);
  return {
    lesson,
    moduleTitle: lesson ? getModuleBySlug(lesson.moduleSlug)?.title : undefined,
    href: lesson ? `/learn/${lesson.moduleSlug}/${lesson.slug}` : null,
    reason: reasonLabels[recommendation.reasonCode],
  };
}
