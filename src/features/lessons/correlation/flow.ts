import { correlationLessons } from "./manifest";

type Step = { title: string; kind?: "lesson" | "mastery"; blocks: readonly string[] };

/** Presentation order only. Explanations, examples and answers stay in the authored lessons. */
export const correlationSteps: Record<string, readonly Step[]> = {
  [correlationLessons[0].id]: [
    { title: "Stejný směr, jiná velikost", blocks: ["prediction"] },
    { title: "Pohyb spolu", blocks: ["meaning", "range"] },
    { title: "Prozkoumej čtyři dvojice", blocks: ["explorer", "read-check"] },
    { title: "Jak se korelace počítá", blocks: ["formula", "steps", "worked"] },
    { title: "Spočítej ji", kind: "mastery", blocks: ["practice"] },
    { title: "Směr, ne velikost", blocks: ["size-callout", "size-check"] },
    { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
  ],
  [correlationLessons[1].id]: [
    { title: "Zmrzlina a opalovací krém", blocks: ["prediction"] },
    { title: "Tři cesty ke korelaci", blocks: ["three-reasons"] },
    { title: "Společný pohyb trhu", blocks: ["factor-explorer", "factor-check"] },
    { title: "Krátké období klame", blocks: ["chance-callout", "chance-check"] },
    { title: "Výnosy, ne ceny", kind: "mastery", blocks: ["prices-callout", "prices-check"] },
    { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
  ],
  [correlationLessons[2].id]: [
    { title: "Klid a bouře", blocks: ["prediction"] },
    { title: "Korelace se mění", blocks: ["changes"] },
    { title: "Projdi klid a krizi", blocks: ["crisis-explorer", "explorer-check"] },
    { title: "Ochrana slábne", blocks: ["protection", "bonds", "bonds-check"] },
    { title: "Které období platí", kind: "mastery", blocks: ["lab-period", "lab-check"] },
    { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
  ],
  [correlationLessons[3].id]: [
    { title: "Jedno číslo, jedna věta", blocks: ["intro", "scenario-check"] },
    { title: "Vyzkoušej to na reálných datech", blocks: ["real-history", "real-history-figure"] },
    { title: "Spočítej korelaci", blocks: ["calc-check"] },
    { title: "Příčina, nebo společný pohyb", blocks: ["causation-check"] },
    { title: "Když přijde krize", kind: "mastery", blocks: ["crisis-check"] },
    { title: "Shrň si to", blocks: ["lab-bridge", "summary", "takeaway", "checkpoint"] },
  ],
};
