# Referenční podoba cvičení #121

Snímky skutečných rendererů doplňují [katalog typů kroků](../../education/lesson-steps.md) a existující exporty Pen F–M. Obsah je fiktivní QA ukázka enginu, nikoli publikovaná lekce. Zdrojem dat je `src/features/lessons/exercise-fixtures.ts`; pořízení zajišťuje `npm run test:lesson-exercises-browser`. Zachovány jsou společné formulářové prvky, zpětná vazba a navigace lekce. Vývojový indikátor Next.js je při exportu skrytý.

Ověřeno 21. 10. 2026. Browser suite kromě těchto snímků kontroluje 320, 375, 390, 768, 1024 a 1440 px, ovládání klávesnicí a 200% velikost textu. Snímky nenahrazují samostatný test čtečkou obrazovky.

| Typ / stav | 390 px | 1440 px |
| --- | --- | --- |
| Třídění: zpětná vazba | [Mobil](categorize-wrong-390.png) | [Desktop](categorize-wrong-1440.png) |
| Řazení | [Mobil](order-390.png) | [Desktop](order-1440.png) |
| Jedna oblast dokumentu | [Mobil](document-390.png) | [Desktop](document-1440.png) |
| Číslo z dokumentu | [Mobil](numeric-document-390.png) | [Desktop](numeric-document-1440.png) |
| Chybný krok | [Mobil](find-error-390.png) | [Desktop](find-error-1440.png) |
| Rozhodovací strom | [Mobil](decision-390.png) | [Desktop](decision-1440.png) |
| Checklist | [Mobil](checklist-390.png) | [Desktop](checklist-1440.png) |
| Psaný výstup a rubrika | [Mobil](rubric-390.png) | [Desktop](rubric-1440.png) |
