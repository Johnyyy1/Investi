import type { StepDefinition } from "../types";
import { diversificationLessons } from "./manifest";

/** Presentation order only. Explanations, examples and answers stay in the authored lessons. */
export const diversificationSteps: Record<string, readonly StepDefinition[]> = {
  [diversificationLessons[0].id]: [
    { title: "Deset firem, nebo čtyři", blocks: ["prediction"] },
    { title: "Váha pozice", blocks: ["weights", "weight-formula", "weight-practice"] },
    { title: "Prozkoumej největší pozici", blocks: ["explorer", "rule"] },
    { title: "Dopad na celé portfolio", blocks: ["impact", "impact-practice"] },
    { title: "Počet nestačí", kind: "mastery", blocks: ["count", "count-check"] },
    { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
  ],
  [diversificationLessons[1].id]: [
    { title: "Pět firem, jedno odvětví", blocks: ["prediction"] },
    { title: "Sektory", blocks: ["sectors"] },
    { title: "Porovnej dvě portfolia", blocks: ["explorer", "sector-practice"] },
    { title: "Země a měna", blocks: ["countries", "currency-check"] },
    { title: "Co ještě chybí", kind: "mastery", blocks: ["mastery", "mastery-check"] },
    { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
  ],
  [diversificationLessons[2].id]: [
    { title: "Kolik máš ve firmě Čip", blocks: ["prediction"] },
    { title: "Pohled dovnitř fondu", blocks: ["look-through", "formula", "worked"] },
    { title: "Prozkoumej fondy a akcie", blocks: ["explorer", "sector-practice"] },
    { title: "Překryv fondů", blocks: ["overlap", "overlap-check"] },
    { title: "Jeden fond, nebo deset akcií", kind: "mastery", blocks: ["world", "world-check"] },
    { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
  ],
  [diversificationLessons[3].id]: [
    { title: "Dvě dvacítky", blocks: ["prediction"] },
    { title: "Výkyvy se vyruší", blocks: ["cancel", "formula", "worked"] },
    { title: "Prozkoumej korelaci a váhy", blocks: ["explorer", "practice"] },
    { title: "Korelace +1", blocks: ["one-check"] },
    { title: "Když korelace roste", kind: "mastery", blocks: ["crisis", "pair-check"] },
    { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
  ],
  [diversificationLessons[4].id]: [
    { title: "Zadání scénáře", blocks: ["intro", "scenario-check"] },
    { title: "Sestav portfolio", blocks: ["rules", "scenario"] },
    { title: "Výsledek není známka", blocks: ["outcome", "luck-check"] },
    { title: "Pohled dovnitř", blocks: ["look-through-check"] },
    { title: "Co přidat", kind: "mastery", blocks: ["correlation-check"] },
    { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
  ],
};
