---
name: Lekce
about: Zadání nové nebo upravené lekce pro agenta
title: "Lekce: "
labels: lesson
---

<!--
Agent: před prací si přečti AGENTS.md (část 8), docs/education/lesson-standard.md a docs/education/lesson-steps.md.
Lekci skládej jen z existujících typů kroků. Nové komponenty, styly ani layouty nevytvářej.
Když chybí typ kroku, zastav se a napiš to do PR.
-->

## Identita a umístění

- Stabilní ID / modul / slug:
- Úroveň, zobrazovací modul a pořadí (registr `lessonPlacements`):
- Předpoklady a dovednosti:
- Nová lekce / oprava publikované lekce:

## Výsledek

Po lekci dokážeš …

Pozorovatelné rozhodnutí nebo výstup a kritérium správnosti:

## Plán kroků

Každý řádek je jeden krok. Typ vyber z docs/education/lesson-steps.md.

| # | Název kroku | Typ (`type`) | Hodnocený | Poznámka |
| --- | --- | --- | --- | --- |
| 1 |  |  |  |  |
| 2 |  |  |  |  |

## Scénář a data

- Česká situace, fiktivní podklady (broker, fond, persona), měna, období:
- Výpočty, které musí test přepočítat ze vstupů:

## Fakta

- Klíče z registru faktů (`src/features/facts/registry.ts`), nové fakty se zdrojem a datem:
- Odborná revize (daně): kdo / kdy / stav

## Napojení na Lab

- Existující oblast Labu a co v ní člověk udělá (nebo „bez Labu“):

## Akceptační kritéria

- [ ] Jen existující typy kroků, žádné nové komponenty ani styly.
- [ ] Screenshoty každého kroku na 390 a 1440 px v PR, shodné s docs/design/lesson-steps.
- [ ] Testy podle standardu lekce (struktura, přepočet odpovědí, zapojení, kompatibilita).
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` zelené.
