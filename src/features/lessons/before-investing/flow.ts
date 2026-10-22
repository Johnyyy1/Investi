import type { StepDefinition } from "../types";
export const beforeInvestingSteps: Readonly<Record<string, readonly StepDefinition[]>> = {
  "before-investing-budget": [
    { title: "Kolik může Petra investovat?", blocks: ["opening", "prediction"] },
    { title: "Sečti příjmy a výdaje", blocks: ["cash-flow", "example", "rate-formula"] },
    { title: "Spočítej míru úspor", blocks: ["rate"] },
    { title: "Nezapomeň na roční platby", blocks: ["irregular", "monthly"] },
    { title: "Oprav Petřin rozpočet", blocks: ["adjusted"] },
    { title: "Rozliš druhy výdajů", blocks: ["categories"] },
    { title: "Zařaď výdaje", blocks: ["sorting"] },
    { title: "Rozhodni o přebytku", kind: "mastery", blocks: ["priorities", "tomas"] },
    { title: "Vyzkoušej vlastní rozpočet", blocks: ["builder"] },
    { title: "Vybav si postup", kind: "mastery", blocks: ["recall"] },
    { title: "Vysvětli změnu a zvol pojistku", blocks: ["reflection"] },
    { title: "Co si odneseš", blocks: ["summary", "safeguard", "next-topic"] },
  ],
};
