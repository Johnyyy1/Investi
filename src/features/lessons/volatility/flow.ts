import type { StepDefinition } from "../types";
import { volatilityLessons } from "./manifest";

/** Presentation order only. Explanations, examples and answers stay in the authored lessons. */
export const volatilitySteps: Record<string, readonly StepDefinition[]> = {
  [volatilityLessons[0].id]: [
    { title: "Stejný cíl, jiná cesta", blocks: ["prediction"] },
    { title: "Riziko a volatilita", blocks: ["risk-meaning", "risk-vs-volatility"] },
    { title: "Projdi obě cesty", blocks: ["paths-figure", "swing-return"] },
    { title: "Kolísání oběma směry", blocks: ["spread-callout", "both-directions"] },
    { title: "Co volatilita neřekne", kind: "mastery", blocks: ["limits", "meaning-check"] },
    { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
  ],
  [volatilityLessons[1].id]: [
    { title: "Stejný průměr, jiná řada", blocks: ["prediction"] },
    { title: "Začni průměrem", blocks: ["mean", "mean-formula"] },
    { title: "Odchylky od průměru", blocks: ["deviations", "why-square"] },
    { title: "Směrodatná odchylka", blocks: ["sd-formula", "n-minus-one", "sd-example"] },
    { title: "Prozkoumej výpočet", blocks: ["sd-explorer"] },
    { title: "Spočítej ji", kind: "mastery", blocks: ["sd-practice"] },
    { title: "Jednotky a období", blocks: ["units", "units-check"] },
    { title: "Shrň si to", blocks: ["summary", "takeaway", "checkpoint"] },
  ],
  [volatilityLessons[2].id]: [
    { title: "Od dne k roku", blocks: ["prediction"] },
    { title: "Proč ne krát 252", blocks: ["why-not-times", "annual-formula"] },
    { title: "Tři frekvence dat", blocks: ["frequencies", "assumption"] },
    { title: "Vyzkoušej anualizaci", blocks: ["annualisation-explorer", "monthly-practice"] },
    { title: "Stejně jako v Labu", blocks: ["lab-conventions"] },
    { title: "Vyzkoušej to na reálných datech", blocks: ["real-history", "real-history-figure"] },
    { title: "Porovnej férově", kind: "mastery", blocks: ["compare-check"] },
    { title: "Shrň si to", blocks: ["summary", "takeaway", "checkpoint"] },
  ],
  [volatilityLessons[3].id]: [
    { title: "Kde začíná propad", blocks: ["prediction"] },
    { title: "Propad od vrcholu", blocks: ["drawdown-definition", "drawdown-formula", "running-peak"] },
    { title: "Projdi cestu měsíc po měsíci", blocks: ["drawdown-explorer", "depth-practice"] },
    { title: "Cesta zpět je delší", blocks: ["recovery", "recovery-explorer", "recovery-practice"] },
    { title: "Na pořadí záleží", kind: "mastery", blocks: ["order-matters", "order-check"] },
    { title: "Vyzkoušej to na reálných datech", blocks: ["real-history", "real-history-figure"] },
    { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
  ],
  [volatilityLessons[4].id]: [
    { title: "Dva fondy, čtyři čísla", blocks: ["intro", "scenario", "scenario-check"] },
    { title: "Spočítej rozptyl", blocks: ["sd-check"] },
    { title: "Převeď na rok", blocks: ["annualise-check"] },
    { title: "Najdi největší propad", blocks: ["drawdown-check"] },
    { title: "Cesta zpět", blocks: ["recovery-check"] },
    { title: "Co čísla neřeknou", kind: "mastery", blocks: ["past-check"] },
    { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
  ],
};
