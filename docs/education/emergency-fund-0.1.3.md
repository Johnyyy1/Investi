# 0.1.3 — Rezerva: kolik a kde

Implementace [#150](https://github.com/Johnyyy1/Investnik/issues/150). **Redakční koncept, ne publikovaná lekce.** Před publikací je podle zadání nutná odborná revize celého obsahu (#133); ověření zdrojů agentem ji nenahrazuje.

- Stabilní identita: `before-investing-emergency-fund`, modul `module-before-investing`, slug `emergency-fund`, budoucí URL `/learn/before-investing/emergency-fund`.
- Umístění 0.1.3, doporučená L0, předpoklad `before-investing-budget` (0.1.1). Mezera 0.1.2 je záměrná. Existující ID, bloky, pořadí a uložené kurzory jiných lekcí se nemění.
- Manifest je `planned`; `getAuthoredLesson` ji nevydává, veřejná URL zobrazí not-found, server odmítne postup/dokončení. Obsah je exportován z registru zvlášť pro redakční náhled `/dev/emergency-fund`, který v produkci zobrazí not-found. Náhled nevolá žádné mutace.
- Dvanáct kroků: výpadek příjmu → pravidlo palce → situace OSVČ → dostupnost → pojištění → reálný výnos → výpočet → daň/podmínky → kalkulačka → vybavení → sebevysvětlení → shrnutí. Nejvýše jedna hodnocená otázka na krok, poslední bez otázky. Pravidlo 3–6 měsíců je výslovně pravidlo palce.

## Fakta a příklady

Používají se existující klíče `makro.inflace`, `makro.repo`, `dan.urok_srazka` a `vklady.limit`. Limit vkladů dodala již rešerše #134; nevzniká duplicitní fakt. Tokeny v próze i číselné vstupy kalkulačky řeší serverový `prepareLessonFacts`. Kalkulačka dostává desetinné sazby, období, datum ověření, zdroj a příznak zastaralosti. Nezískává registry ani neparsuje formátované tokeny. Neověřená/blokovaná sazba nebo chybějící platnost výpočet zastaví, nikdy se nedosadí nula. Hlavička používá nejstarší ověření faktů lekce.

Primární zdroje znovu zkontrolovány 23. 10. 2026 (bez posouvání historických dat ověření v registru):

- [ČSÚ, CPI září 2026](https://csu.gov.cz/rychle-informace/indexy-spotrebitelskych-cen-inflace-zari-2026): meziroční pozorování, nikoli roční prognóza.
- [ČNB, nástroje měnové politiky](https://www.cnb.cz/cs/menova-politika/mp-nastroje/): repo sazba je kontext, nikoli nabídka banky.
- [Finanční správa, kapitálové příjmy](https://financnisprava.gov.cz/cs/dane/dane/dan-z-prijmu/fyzicke-osoby/kapitalove-prijmy): vymezení českého nepodnikatelského bankovního účtu; nepřenášet na fondy a zahraniční brokery.
- [GSFT, informační leták](https://www.gsft.cz/ke-stazeni/gsft_skladany_letak.pdf): základní limit na klienta a instituci, nikoli na účet; cenné papíry nejsou pojištěný vklad.

Modelová sazba a inflace ve výpočetním cvičení jsou označené jako pevné hypotetické vstupy. Nemění se s živým faktem: u již uložených odpovědí se tím neposouvá význam otázky. Číselný úkol vyžaduje zaokrouhlení na dvě místa, tolerance je 0,01 procentního bodu. Odpověď 1,00 % má cílené vysvětlení aproximace a vyžaduje opravu. Původně navržená tolerance 0,02 by 1,00 % přijímala; tomu se záměrně vyhýbáme.

Kalkulačka počítá cíl výdaje × měsíce a roční nominální/čistý/reálný výnos. Výchozí inflaci bere z registru; její změna je viditelně modelový předpoklad. Daňová sazba zůstává datovaným vstupem ze serveru. Model předpokládá stálý zůstatek a sazbu, jedno roční připsání úroku a žádné poplatky. Není to výpočet bankovní daně ani portfolio účetnictví. Prázdný/neplatný vstup odstraní výsledek. Čárka i tečka fungují; mezní hodnoty a deflace jsou testované.

## Hranice integrace a publikace

Částky i reflexe jsou dočasné a nikam se neodesílají. Do Labu nevznikají vklady ani obchody. Aktuální IPS v2 uchovává kategorii rezervy (`foundation.emergencyFund`), nikoli její částku; check-up také uchovává pouze kategorii. Automatické předvyplnění částky by vyžadovalo nové verzované schéma a výslovný souhlas s uložením citlivých vstupů. Tato lekce stávající kontrakt soukromí nerozšiřuje. Před integrací do #154/#128 vyřešit samostatně záměr ukládání a verzi artefaktu.

Před publikací:

1. Zapsat skutečnou odbornou revizi a verze faktů podle #133. Žádný souhlas není předstírán.
2. Znovu ověřit platnost všech faktů pro datum vydání, srozumitelnost, dobu průchodu a roční model úroku.
3. Přesunout obsah do `authoredLessons`, nastavit manifest `available` a odebrat výjimky konceptu v integritních testech. Spustit standardní seed; žádná migrace schématu není potřebná. Ověřit skutečnou persistenci/obnovu/dokončení, jednorázovou XP-only účtenku v politice v4 a nezměněné odemčení Labu.

Aktuální odměnová politika na main je v4: L0 je XP-only. Tato implementace politiku ani staré účtenky nemění. Údaj v issue o v3 už nepopisuje současný kód.

## Ověření

Unit test přepočítává obě hranice rezervy i reálný výnos z původních vstupů; testuje chybné odpovědi a přechody, nepřítomnost veřejné lekce, typované faktové vstupy, zastaralost, změnu registry a přesnost 0,1 / 0,25 / 1,3333. `npm run test:emergency-fund-browser` na čerstvém dev runtime ověřuje všech dvanáct kroků, chybu a opravu, kalkulačku, soukromí bez POST, klávesnici, fokus, všechny kroky na 320/390/1440 px a kalkulačku při 200% textu. Snímky jsou v `test-results/emergency-fund` (necommitují se). Produkční not-found náhledu ověřit zvlášť po buildu. Chromium automatizace nenahrazuje kontrolu fyzického zařízení nebo čtečky obrazovky.
