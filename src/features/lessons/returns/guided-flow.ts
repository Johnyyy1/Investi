import type { AuthoredLesson } from "../types";
import { compoundingSteps } from "./compounding-flow";
import { foundationsSteps } from "../foundations/content";
import { volatilitySteps } from "../volatility/flow";
import { correlationSteps } from "../correlation/flow";
import { diversificationSteps } from "../diversification/flow";
import { availableLessons } from "../../learning/catalog";
import { returnsLessons } from "./manifest";

type Step = { title: string; kind?: "lesson" | "mastery"; blocks: readonly string[] };
const introductionSteps: Step[] = [
  { title: "Co měří výnos?", blocks: ["meaning", "price-change"] },
  { title: "Uveď změnu do kontextu", blocks: ["formula-one", "formula-two"] },
  { title: "Projdi si příklad", blocks: ["example-100", "positive-negative"] },
  { title: "Porovnej procentní změny", blocks: ["comparing", "compare-assets"] },
  { title: "Předpověz výsledek", blocks: ["prediction"] },
  { title: "Vyzkoušej kalkulačku výnosu", blocks: ["calculate"] },
  { title: "Vypočítej výnos", blocks: ["numeric"] },
  { title: "Ověř si porozumění", blocks: ["why-percent"] },
  { title: "Shrň si to", blocks: ["check", "takeaway", "checkpoint"] },
];
const simpleSteps: Step[] = [
  { title: "Jedno období po druhém", blocks: ["periods", "period-intro"] },
  { title: "Použij předchozí cenu", blocks: ["period-formula-one", "period-formula-two"] },
  { title: "Sleduj měnící se jmenovatel", blocks: ["period-example"] },
  { title: "Prozkoumej časovou řadu ceny", blocks: ["series", "series-figure"] },
  { title: "Vypočítej zisk", blocks: ["first-calculation"] },
  { title: "Vypočítej ztrátu", blocks: ["negative-return"] },
  { title: "Desetinná čísla a procenta", blocks: ["representation", "decimal-callout", "decimal-practice"] },
  { title: "Spočítej výnosová pozorování", blocks: ["comparison"] },
  { title: "Promysli dvě období", blocks: ["practice", "two-periods"] },
  { title: "Vyzkoušej to na reálných datech", blocks: ["real-series", "real-series-figure"] },
  { title: "Shrň si to", blocks: ["raw-differences", "takeaway", "checkpoint"] },
];
const comparingSteps: Step[] = [
  { title: "Stejná cena, stejný výsledek?", blocks: ["prediction"] },
  { title: "Co měří cenový výnos", blocks: ["price-return", "price-formula", "price-example"] },
  { title: "Připočti vyplacenou hotovost", blocks: ["cash-example", "cash-formula"] },
  { title: "Celkový výnos potřebuje metodiku", blocks: ["total-return", "methodology", "return-definitions"] },
  { title: "Porovnávej na společném základě", blocks: ["comparison-basis", "definition-and-costs", "splits"] },
  { title: "Přečti výnos v Labu správně", blocks: ["instrument-detail", "investor-return"] },
  { title: "Stačí shodných osm procent?", kind: "mastery", blocks: ["comparison-example", "fair-comparison"] },
  { title: "Shrň si to", blocks: ["takeaway", "checkpoint"] },
];
const logSteps: Step[] = [
  { title: "Deset nahoru, deset dolů", blocks: ["prediction"] },
  { title: "Proč jednoduché výnosy nesčítáme", blocks: ["multiplication", "purpose"] },
  { title: "Seznam se s logaritmickým výnosem", blocks: ["log-definition", "log-formula", "log-example", "log-calculation"] },
  { title: "Převeď výnos tam a zpět", blocks: ["conversion", "to-log", "to-simple", "round-trip"] },
  { title: "Od násobení ke sčítání", blocks: ["time-addition", "transformation", "log-identity"] },
  { title: "Blízko neznamená stejně", blocks: ["small-moves", "small-check"] },
  { title: "Spoj dvě období správně", kind: "mastery", blocks: ["comparison", "comparison-check"] },
  { title: "Shrň si to", blocks: ["summary", "takeaway", "checkpoint"] },
];
const checkpointSteps: Step[] = [
  { title: "Dvě akcie, jedna otázka", blocks: ["intro", "opening-check"] },
  { title: "Výnos každého roku", blocks: ["scenario", "period-check"] },
  { title: "Celé období", blocks: ["cumulative-check"] },
  { title: "Cesta zpět na vrchol", blocks: ["recovery-check"] },
  { title: "Cenový a celkový výnos", blocks: ["total-check"] },
  { title: "Sečti logaritmy", kind: "mastery", blocks: ["log-check"] },
  { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
];
export function getStepDefinitions(lessonId: string): readonly Step[] {
  if (lessonId === returnsLessons[0].id) return introductionSteps;
  if (lessonId === returnsLessons[1].id) return simpleSteps;
  if (lessonId === returnsLessons[2].id) return compoundingSteps;
  if (lessonId === returnsLessons[3].id) return comparingSteps;
  if (lessonId === returnsLessons[4].id) return logSteps;
  if (lessonId === returnsLessons[5].id) return checkpointSteps;
  if (foundationsSteps[lessonId]) return foundationsSteps[lessonId];
  if (volatilitySteps[lessonId]) return volatilitySteps[lessonId];
  if (correlationSteps[lessonId]) return correlationSteps[lessonId];
  if (diversificationSteps[lessonId]) return diversificationSteps[lessonId];
  throw new Error("This lesson is not available.");
}
/** Presentation only: the authored lessons remain the source of every concept and exercise. */
export function getGuidedSteps(lesson: AuthoredLesson) {
  return getStepDefinitions(lesson.id).map((step) => ({ title: step.title, kind: step.kind, blocks: step.blocks.map((id) => {
    const block = lesson.blocks.find((item) => item.id === id);
    if (!block) throw new Error(`Missing authored block: ${id}`);
    return block;
  }) }));
}
export function isFocusedLesson(pathname: string) {
  return availableLessons.some((lesson) => pathname === `/learn/${lesson.moduleSlug}/${lesson.slug}`);
}
