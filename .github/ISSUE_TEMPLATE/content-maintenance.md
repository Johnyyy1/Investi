---
name: Údržba obsahu
about: Opakovaná kontrola faktů a lekcí podle kalendáře údržby
title: "Údržba obsahu: "
labels: copy
---

<!-- Kalendář, vlastníci a stavy: docs/education/editorial-workflow.md -->

## Období a vlastník

- Období (např. leden 2027 / měsíčně říjen 2026 / ad hoc):
- Role vlastníka:

## Co zkontrolovat

Seznam podle kalendáře; ke každé položce klíč faktu nebo lekci.

- [ ] …

## Výsledek

- [ ] Změněné hodnoty mají novou verzi faktu (uzavřený interval předchozí, zdroj, skutečné datum ověření); nic se nedoplňuje nulou.
- [ ] Nezměněné hodnoty mají aktualizované `verifiedAt` / `checkedAt` a nové `nextReviewAt`.
- [ ] Dotčené publikované daňové a regulatorní lekce mají nový záznam odborné revize, jinak neprojde `npm run check:facts`.
- [ ] Zjištění, která nelze vyřešit hned, mají vlastní issue.
