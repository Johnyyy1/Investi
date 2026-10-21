import type { StepDefinition } from "../types";
import { compoundingSteps } from "./compounding-flow";
import { returnsLessons } from "./manifest";

const introductionSteps: StepDefinition[] = [
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
const simpleSteps: StepDefinition[] = [
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
const comparingSteps: StepDefinition[] = [
  { title: "Stejná cena, stejný výsledek?", blocks: ["prediction"] },
  { title: "Co měří cenový výnos", blocks: ["price-return", "price-formula", "price-example"] },
  { title: "Připočti vyplacenou hotovost", blocks: ["cash-example", "cash-formula"] },
  { title: "Celkový výnos potřebuje metodiku", blocks: ["total-return", "methodology", "return-definitions"] },
  { title: "Porovnávej na společném základě", blocks: ["comparison-basis", "definition-and-costs", "splits"] },
  { title: "Přečti výnos v Labu správně", blocks: ["instrument-detail", "investor-return"] },
  { title: "Stačí shodných osm procent?", kind: "mastery", blocks: ["comparison-example", "fair-comparison"] },
  { title: "Shrň si to", blocks: ["takeaway", "checkpoint"] },
];
const logSteps: StepDefinition[] = [
  { title: "Deset nahoru, deset dolů", blocks: ["prediction"] },
  { title: "Proč jednoduché výnosy nesčítáme", blocks: ["multiplication", "purpose"] },
  { title: "Seznam se s logaritmickým výnosem", blocks: ["log-definition", "log-formula", "log-example", "log-calculation"] },
  { title: "Převeď výnos tam a zpět", blocks: ["conversion", "to-log", "to-simple", "round-trip"] },
  { title: "Od násobení ke sčítání", blocks: ["time-addition", "transformation", "log-identity"] },
  { title: "Blízko neznamená stejně", blocks: ["small-moves", "small-check"] },
  { title: "Spoj dvě období správně", kind: "mastery", blocks: ["comparison", "comparison-check"] },
  { title: "Shrň si to", blocks: ["summary", "takeaway", "checkpoint"] },
];
const checkpointSteps: StepDefinition[] = [
  { title: "Dvě akcie, jedna otázka", blocks: ["intro", "opening-check"] },
  { title: "Výnos každého roku", blocks: ["scenario", "period-check"] },
  { title: "Celé období", blocks: ["cumulative-check"] },
  { title: "Cesta zpět na vrchol", blocks: ["recovery-check"] },
  { title: "Cenový a celkový výnos", blocks: ["total-check"] },
  { title: "Sečti logaritmy", kind: "mastery", blocks: ["log-check"] },
  { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
];
/** Presentation order only. Explanations, examples and answers stay in the authored lessons. */
export const returnsSteps: Record<string, readonly StepDefinition[]> = {
  [returnsLessons[0].id]: introductionSteps,
  [returnsLessons[1].id]: simpleSteps,
  [returnsLessons[2].id]: compoundingSteps,
  [returnsLessons[3].id]: comparingSteps,
  [returnsLessons[4].id]: logSteps,
  [returnsLessons[5].id]: checkpointSteps,
};
