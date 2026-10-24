import type { StepDefinition } from "../types";

export const brokerAndAccountSteps: Readonly<Record<string, readonly StepDefinition[]>> = {
  "broker-platform-types": [
    { title: "Tři reklamy, jedno rozhodnutí", blocks: ["opening", "prediction"] },
    { title: "Čtyři typy služeb", blocks: ["types"] },
    { title: "Aplikace není vždy broker", blocks: ["intermediary", "app-check"] },
    { title: "Roztřiď osm nabídek", blocks: ["sorting"] },
    { title: "Kdo rozhoduje o nákupech", blocks: ["decides"] },
    { title: "Broker z jiného státu EU", blocks: ["passport", "passport-facts", "passport-check"] },
    { title: "Co v ceně je a není", blocks: ["costs", "cost-myths"] },
    { title: "Jana nechce nic vybírat", blocks: ["persona"] },
    { title: "Stejné nabídky, jiný plán", blocks: ["plan-compare", "one-off"] },
    { title: "Podle čeho vybírat", blocks: ["criteria", "no-best"] },
    { title: "Vybav si rozdíl", kind: "mastery", blocks: ["recall"] },
    { title: "Vysvětli vlastními slovy", blocks: ["reflection"] },
    { title: "Co si odneseš", blocks: ["sources", "summary"] },
  ],
};
