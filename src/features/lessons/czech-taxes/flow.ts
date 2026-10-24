import type { StepDefinition } from "../types";

export const czechTaxesSteps: Readonly<Record<string, readonly StepDefinition[]>> = {
  "taxes-filing-obligation": [
    { title: "Musí Jana podat přiznání?", blocks: ["opening", "prediction"] },
    { title: "Obecné pravidlo a zaměstnanecká výjimka", blocks: ["rules"] },
    { title: "Co do hranic nepatří", blocks: ["exemptions"] },
    { title: "Janin příjem krok za krokem", blocks: ["jana", "gross"] },
    { title: "Projdi rozhodovací postup", blocks: ["tree"] },
    { title: "Zahraniční dividendy", blocks: ["persona-a"] },
    { title: "Doplň závěr pro Báru", blocks: ["persona-b"] },
    { title: "Příjem a rozdíl po nákladech", blocks: ["student-inputs", "student-amounts"] },
    { title: "Rozhodni bez nápovědy", kind: "mastery", blocks: ["persona-c"] },
    { title: "Bez zisku neznamená bez povinností", blocks: ["loss-question"] },
    { title: "Lhůty a samostatné oznámení", blocks: ["deadlines", "notification"] },
    { title: "Vybav si, co se nepočítá", kind: "mastery", blocks: ["recall"] },
    { title: "Zvol kontrolní postup", blocks: ["reflection"] },
    { title: "Co si odneseš", blocks: ["sources", "lab", "summary"] },
  ],
};
