import { BEFORE_INVESTING_MODULE_ID, beforeInvestingLessons } from "../lessons/before-investing/manifest";
import { FOUNDATIONS_MODULE_ID, foundationsLessons } from "../lessons/foundations/manifest";
import { RETURNS_MODULE_ID, returnsLessons } from "../lessons/returns/manifest";
import { VOLATILITY_MODULE_ID, volatilityLessons } from "../lessons/volatility/manifest";
import { CORRELATION_MODULE_ID, correlationLessons } from "../lessons/correlation/manifest";
import { DIVERSIFICATION_MODULE_ID, diversificationLessons } from "../lessons/diversification/manifest";

/**
 * Curriculum 2.0 registry. Typed code, no database.
 *
 * Two module concepts live side by side:
 * - a storage module is a `learning_module` row. It owns lesson IDs, URLs (`/learn/{moduleSlug}/{slug}`)
 *   and historical v3 reward eligibility. Lessons never move between storage modules;
 * - a display module (code "3.3") is how the curriculum presents lessons. It may combine lessons from several
 *   storage modules. Its level determines new v4 lesson rewards. A display code ("3.3.6") is metadata only;
 *   the lesson ID stays stable and existing reward receipts are never recalculated.
 */

/** Storage modules in today's learning sequence. `seedCurriculum` upserts these rows. */
export const storageModules = [
  { id: FOUNDATIONS_MODULE_ID, slug: "investing-foundations", title: "Základy investování", description: "Vybuduj si základní představy, které potřebuješ před analýzou investic.", status: "available", lessons: foundationsLessons },
  { id: RETURNS_MODULE_ID, slug: "returns", title: "Výnos a složené zhodnocení", description: "Od změn cen ke srovnatelným výsledkům investic.", status: "available", lessons: returnsLessons },
  { id: VOLATILITY_MODULE_ID, slug: "volatility", title: "Volatilita", description: "Měření rozsahu a nejistoty výnosů.", status: "available", lessons: volatilityLessons },
  { id: CORRELATION_MODULE_ID, slug: "correlation", title: "Korelace", description: "Jak se aktiva pohybují společně — a kdy ne.", status: "available", lessons: correlationLessons },
  { id: DIVERSIFICATION_MODULE_ID, slug: "diversification", title: "Diverzifikace", description: "Sestavování portfolií, která promyšleně rozkládají riziko.", status: "available", lessons: diversificationLessons },
  { id: BEFORE_INVESTING_MODULE_ID, slug: "before-investing", title: "Než začneš investovat", description: "Začni rozpočtem: příjmy, výdaje a realistická částka k odkládání.", status: "available", lessons: beforeInvestingLessons },
] as const;

export type MilestoneId = "A" | "B" | "C" | "D";
export const milestones: Readonly<Record<MilestoneId, string>> = {
  A: "Připraven/a začít",
  B: "Samostatný pasivní investor",
  C: "Samostatný analytik akcií",
  D: "Kvantitativní investor",
};

/** Levels in display order. The milestone is the first one the level counts towards; V counts towards none. */
export const curriculumLevels = [
  { id: "L0", code: "0", title: "Než začneš investovat", milestone: "A" },
  { id: "L1", code: "1", title: "Jak investice fungují", milestone: "A" },
  { id: "L2", code: "2", title: "Investování v Česku v praxi", milestone: "A" },
  { id: "B", code: "B", title: "Investor v zrcadle", milestone: "B" },
  { id: "L3", code: "3", title: "Portfolio: stavba, údržba a měření", milestone: "B" },
  { id: "L4", code: "4", title: "Analýza akcií", milestone: "C" },
  { id: "L5", code: "5", title: "Oceňování a investiční teze", milestone: "C" },
  { id: "L6", code: "6", title: "Kvantitativní metody", milestone: "D" },
  { id: "V", code: "V", title: "Volitelná pokročilá témata", milestone: null },
] as const satisfies readonly { id: string; code: string; title: string; milestone: MilestoneId | null }[];
export type CurriculumLevelId = (typeof curriculumLevels)[number]["id"];

/** `optional-track` belongs to the analyst or quant track; `optional` modules sit outside every track. */
export type Requirement = "required" | "recommended" | "optional-track" | "optional";
export type Track = "investor" | "analyst" | "quant";
export type DisplayModule = { code: string; levelId: CurriculumLevelId; title: string; order: number; required: Requirement; track?: Track };

/** All 25 display modules, `order` is the curriculum-wide display order. */
export const displayModules = [
  { code: "0.1", levelId: "L0", title: "Finanční připravenost před prvním investováním", order: 1, required: "recommended", track: "investor" },
  { code: "1.1", levelId: "L1", title: "Investiční základy", order: 2, required: "required", track: "investor" },
  { code: "2.1", levelId: "L2", title: "Broker a investiční účet", order: 3, required: "required", track: "investor" },
  { code: "2.2", levelId: "L2", title: "Poplatky a celkové náklady investování", order: 4, required: "required", track: "investor" },
  { code: "2.3", levelId: "L2", title: "Produkty v EU a výběr ETF", order: 5, required: "required", track: "investor" },
  { code: "2.4", levelId: "L2", title: "Daně investora v České republice", order: 6, required: "required", track: "investor" },
  { code: "2.5", levelId: "L2", title: "První plán a první nákup", order: 7, required: "required", track: "investor" },
  { code: "B.1", levelId: "B", title: "Investor v zrcadle — behaviorální chyby a pojistky", order: 8, required: "required", track: "investor" },
  { code: "3.1", levelId: "L3", title: "Výnos a výkonnost", order: 9, required: "required", track: "investor" },
  { code: "3.2", levelId: "L3", title: "Riziko v číslech", order: 10, required: "required", track: "investor" },
  { code: "3.3", levelId: "L3", title: "Korelace a diverzifikace", order: 11, required: "required", track: "investor" },
  { code: "3.4", levelId: "L3", title: "Alokace aktiv", order: 12, required: "required", track: "investor" },
  { code: "3.5", levelId: "L3", title: "Údržba portfolia", order: 13, required: "required", track: "investor" },
  { code: "4.0", levelId: "L4", title: "Brána: poctivě o šancích", order: 14, required: "optional-track", track: "analyst" },
  { code: "4.1", levelId: "L4", title: "Byznys a odvětví", order: 15, required: "optional-track", track: "analyst" },
  { code: "4.2", levelId: "L4", title: "Účetní výkazy", order: 16, required: "optional-track", track: "analyst" },
  { code: "4.3", levelId: "L4", title: "Finanční ukazatele", order: 17, required: "optional-track", track: "analyst" },
  { code: "5.1", levelId: "L5", title: "Oceňování", order: 18, required: "optional-track", track: "analyst" },
  { code: "5.2", levelId: "L5", title: "Investiční teze a disciplína", order: 19, required: "optional-track", track: "analyst" },
  { code: "6.1", levelId: "L6", title: "Matematika výnosů", order: 20, required: "optional-track", track: "quant" },
  { code: "6.2", levelId: "L6", title: "Riziko a teorie portfolia", order: 21, required: "optional-track", track: "quant" },
  { code: "6.3", levelId: "L6", title: "Backtest bez sebeklamu", order: 22, required: "optional-track", track: "quant" },
  { code: "V.1", levelId: "V", title: "Páka a deriváty", order: 23, required: "optional" },
  { code: "V.2", levelId: "V", title: "Kryptoaktiva", order: 24, required: "optional" },
  { code: "V.3", levelId: "V", title: "Technická analýza kriticky", order: 25, required: "optional" },
] as const satisfies readonly DisplayModule[];
export type DisplayModuleCode = (typeof displayModules)[number]["code"];

/** What a lesson trains. Mastery states (#122) will hang on these IDs. */
export const skills = {
  "emergency-fund": "Rezerva, dostupnost a kupní síla",
  "monthly-budget": "Měsíční rozpočet a nepravidelné výdaje",
  "savings-rate": "Míra úspor",
  "saving-vs-investing": "Spoření a investování",
  inflation: "Inflace a kupní síla",
  "stock-ownership": "Akcie a vlastnictví firmy",
  "position-value": "Hodnota pozice",
  "index-vs-fund": "Index a ETF",
  "bonds-and-cash": "Dluhopisy a hotovost",
  "bid-ask-spread": "Kotace, bid, ask a spread",
  "simple-return": "Jednoduchý výnos",
  compounding: "Složené zhodnocení",
  "loss-recovery": "Zotavení po ztrátě",
  "price-vs-total-return": "Cenový a celkový výnos",
  "log-returns": "Logaritmické výnosy",
  "portfolio-weights": "Váhy v portfoliu",
  diversification: "Diverzifikace",
  volatility: "Volatilita",
  "standard-deviation": "Směrodatná odchylka",
  annualisation: "Anualizace",
  "max-drawdown": "Největší propad",
  correlation: "Korelace",
  "correlation-regimes": "Korelace v krizích",
  "correlation-vs-causation": "Korelace a kauzalita",
  concentration: "Koncentrace",
  "sector-country-exposure": "Sektorová a zemní expozice",
  "etf-look-through": "Pohled dovnitř ETF",
  "portfolio-risk": "Riziko portfolia",
} as const;
export type SkillId = keyof typeof skills;

export type LessonPlacement = {
  lessonId: string;
  displayModule: DisplayModuleCode;
  /** `${displayModule}.${order}`, e.g. "3.3.6". */
  displayCode: string;
  order: number;
  /** Lessons to finish first. Recommendations honour them; they never lock access. */
  prerequisites: readonly string[];
  skills: readonly SkillId[];
  required: Requirement;
};

const place = (lessonId: string, displayModule: DisplayModuleCode, order: number, required: Requirement, prerequisites: readonly string[], lessonSkills: readonly SkillId[]): LessonPlacement =>
  ({ lessonId, displayModule, displayCode: `${displayModule}.${order}`, order, prerequisites, skills: lessonSkills, required });

/** Where each authored lesson, including editorial drafts, sits in Curriculum 2.0. New lessons are added here and in their storage manifest. */
export const lessonPlacements: readonly LessonPlacement[] = [
  place("before-investing-emergency-fund", "0.1", 3, "recommended", ["before-investing-budget"], ["emergency-fund", "inflation"]),
  place("before-investing-budget", "0.1", 1, "recommended", [], ["monthly-budget", "savings-rate"]),
  place("foundations-why-invest", "1.1", 1, "required", [], ["saving-vs-investing", "inflation"]),
  place("foundations-stocks", "1.1", 2, "required", ["foundations-why-invest"], ["stock-ownership", "position-value"]),
  place("foundations-etfs-indexes", "1.1", 3, "required", ["foundations-stocks"], ["index-vs-fund"]),
  place("foundations-bonds-cash", "1.1", 4, "required", ["foundations-stocks"], ["bonds-and-cash"]),
  place("foundations-markets", "1.1", 5, "required", ["foundations-stocks"], ["bid-ask-spread"]),
  place("foundations-risk-reward", "1.1", 6, "required", ["foundations-why-invest"], ["simple-return", "compounding"]),
  place("foundations-portfolio", "1.1", 7, "required", ["foundations-stocks", "foundations-etfs-indexes", "foundations-bonds-cash"], ["portfolio-weights", "diversification"]),

  place("returns-what-is-a-return", "3.1", 1, "required", ["foundations-risk-reward"], ["simple-return"]),
  place("returns-simple-returns", "3.1", 2, "required", ["returns-what-is-a-return"], ["simple-return"]),
  place("returns-compounding", "3.1", 3, "required", ["returns-simple-returns"], ["compounding", "loss-recovery"]),
  place("returns-comparing", "3.1", 4, "required", ["returns-compounding"], ["price-vs-total-return"]),
  // The checkpoint still asks for log returns ("Sečti logaritmy"), so it waits for 6.1.1 until #206 reworks it.
  place("returns-checkpoint", "3.1", 8, "required", ["returns-comparing", "returns-log-returns"], ["simple-return", "compounding", "loss-recovery", "price-vs-total-return", "log-returns"]),

  place("volatility-what-is-volatility", "3.2", 1, "required", ["returns-simple-returns"], ["volatility"]),
  place("volatility-standard-deviation", "3.2", 2, "required", ["volatility-what-is-volatility"], ["standard-deviation"]),
  place("volatility-annualising", "3.2", 3, "required", ["volatility-standard-deviation"], ["annualisation"]),
  place("volatility-max-drawdown", "3.2", 4, "required", ["volatility-what-is-volatility"], ["max-drawdown", "loss-recovery"]),
  place("volatility-checkpoint", "3.2", 5, "required", ["volatility-standard-deviation", "volatility-annualising", "volatility-max-drawdown"], ["standard-deviation", "annualisation", "max-drawdown"]),

  place("correlation-what-is-correlation", "3.3", 1, "required", ["volatility-standard-deviation"], ["correlation"]),
  place("correlation-in-crises", "3.3", 2, "required", ["correlation-what-is-correlation"], ["correlation-regimes"]),
  place("diversification-concentration", "3.3", 3, "required", ["foundations-portfolio"], ["portfolio-weights", "concentration"]),
  place("diversification-sectors-countries", "3.3", 4, "required", ["diversification-concentration"], ["sector-country-exposure"]),
  place("diversification-etf-look-through", "3.3", 5, "required", ["diversification-concentration", "foundations-etfs-indexes"], ["etf-look-through"]),
  place("diversification-correlation-risk", "3.3", 6, "required", ["correlation-what-is-correlation", "volatility-standard-deviation"], ["portfolio-risk"]),
  place("diversification-scenario", "3.3", 7, "required", ["diversification-concentration", "diversification-sectors-countries", "diversification-etf-look-through", "diversification-correlation-risk"], ["concentration", "sector-country-exposure", "etf-look-through", "portfolio-risk"]),

  place("correlation-not-causation", "B.1", 8, "required", [], ["correlation-vs-causation"]),

  place("returns-log-returns", "6.1", 1, "optional-track", ["returns-compounding"], ["log-returns"]),
  place("correlation-real-data", "6.2", 5, "optional-track", ["correlation-what-is-correlation"], ["correlation", "correlation-vs-causation", "correlation-regimes"]),
];

export function getLessonPlacement(lessonId: string) {
  return lessonPlacements.find((placement) => placement.lessonId === lessonId);
}

/** Lessons of one display module in display order, whichever storage modules they come from. */
export function getDisplayModulePlacements(code: DisplayModuleCode) {
  return lessonPlacements.filter((placement) => placement.displayModule === code).sort((a, b) => a.order - b.order);
}
