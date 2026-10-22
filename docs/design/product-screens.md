# Obrazovky produktu P–Z: schválené návrhy

Návrhy obrazovek pro nové kurikulum a milník A, které nejsou typy kroků lekce. Pocházejí z Pen souboru `investi-design.pen`, z nástěnek „Investník / Učení a postup“, „Milník A“, „Lab“ a „Postup a opakování“. Exporty jsou z 21. 10. 2026. Typy kroků uvnitř lekcí popisuje [katalog typů kroků](../education/lesson-steps.md).

**Stav:** jde o návrhy, ne hotové funkce. Každá obrazovka potřebuje vlastní issue a většina z nich doménovou práci (registr, skill model, IPS, obchodní kniha, odměny). Agent, který obrazovku implementuje:

- drží se PNG v této složce a komponent z nástěnky „00 · Komponenty“ ([components/](product-screens/components)); nekreslí vlastní variantu;
- data bere z existujícího zdroje pravdy, nikdy z čísel v návrhu, protože ta jsou ilustrativní;
- nejdřív si přečte otevřené otázky dané obrazovky (NQ-20 až NQ-47 níže). Nerozhodnutou otázku neřeší potichu: zvolí doporučení z návrhu, uvede ho v PR, nebo se zastaví;
- dodrží AGENTS.md, hlavně § 9 (odměny), § 17 (Portfolio Lab), § 18 (izolace scénářů), § 20a (fakta) a § 33/34 (UI vs doménová práce);
- přiloží screenshoty 390 a 1440 px a porovná je s PNG.

Rozdíl proti návrhům: nástěnky ještě místy zmiňují politiku odměn **v3**, v kódu platí **v4**. Rozhoduje kód a AGENTS.md § 9. Rebrand na Investník (NQ-25) už v repozitáři je.

## Nástěnka 1 · Učení a postup

### P · Učení — mapa úrovní a milníků
Hlavní obrazovka záložky Učení. Nahrazuje seznam kapitol, **Pokračovat zůstává jediná primární akce**. Data: registr kurikula (`src/features/learning/curriculum.ts`: úroveň, modul, pořadí, předpoklady, dovednosti, povinnost). Stav modulu se odvozuje z dokončení lekcí. „Zamčeno“ znamená nesplněné předpoklady a vypisuje které. Milník je agregace požadavků.
Návrhy: `p-learn-map-390-new-user`, `p-learn-map-390-milestone-a-in-progress`, `p-learn-map-390-milestone-a-done`, `p-learn-map-1440-milestone-a-in-progress`.
Otevřené: NQ-20 (lekce prokázané vstupním testem), NQ-21 (pořadí doporučení), NQ-26 (úroveň 3 před milníkem A), NQ-27 (linie B na mobilu), NQ-28 (sbalování úrovní).

### Q · Vstupní test (adaptivní)
Volitelně po onboardingu a z karty Pokračovat („Část už umíš?“). Jednou za účet, opakovat jde po 30 dnech. Banka položek s dovednostmi, nejvýše asi 30 položek, možnost „Nevím“ bez trestu. Správnost se po otázkách neukazuje. Výsledek zapisuje lekce „prokázáno / zopakovat / začít tady“ do studijního plánu.
Návrhy: `q-entry-test-390-intro`, `-question`, `-dont-know`, `-result`, `q-entry-test-1440-result`.
Otevřené: NQ-22, NQ-23 (model a práh „prokázáno“ jsou návrh), NQ-20.

### R · Modul a checkpoint
Detail modulu (ukázka: 2.4 Daně investora v ČR) se stavem dovedností Zkoušeno → Známé → Zvládnuté → Ovládnuté. Na konci je smíšený checkpoint (12 položek prokládaných napříč lekcemi) a projekt úrovně se čtyřstupňovou rubrikou, která je vidět předem. Stav dovednosti může klesnout, dokončení lekce nikdy.
Návrhy: `r-module-390-in-progress`, `-checkpoint-available`, `-checkpoint-done`, `r-module-1440-checkpoint-available`.
Otevřené: NQ-24 (zda ukazovat počet správných).

## Nástěnka 2 · Milník A

### S · Investiční plán (IPS)
Sedm kroků: cíl a horizont, rezerva a dluh, alokace (včetně chyby „součet nesedí“), rebalancování, příspěvky a platforma, „co udělám při −30 %“, kontrola a uložení. Pak stránka „Můj plán“. Data: IPS schéma v2 z PR #350 (`src/features/ips/`). Každé uložení je nová verze artefaktu. Neprozrazuje „správnou“ alokaci.
Návrhy: `s-ips-390-step1-goal-horizon` … `s-ips-390-step7-review-save`, `s-ips-390-my-plan`, `s-ips-1440-my-plan`.
Otevřené: NQ-29 (kroky vs jedna stránka; koncept ukládat lokálně), NQ-30 (lekce vs nástroj; návrh: obojí), NQ-35 (název milníku s lomítkem).

### T · Krizový nácvik (B10)
Po uložení IPS, povinná část milníku A. Deterministický fiktivní scénář. **Izolovaný stav: žádné obchody ani hodnoty v trvalém portfoliu.** Hodnotí se dodržení plánu (`drawdownRule`, pásmo), nikdy výsledek trhu.
Návrhy: `t-crisis-390-intro`, `-progress`, `-drawdown-decision`, `-review-plan-kept`, `-review-plan-broken`, `t-crisis-1440-drawdown-decision`.
Otevřené: NQ-31 (co je „v souladu“), NQ-32 (ukazovat vývoj po rozhodnutí jen na vyžádání), NQ-36 (fiktivní vs historický scénář).

### U · Závěrečný projekt milníku A
Shrnutí pěti částí (check-up, srovnání brokerů, IPS, cvičný nákup, krizový nácvik) s odkazy na důkazy a se sebehodnocením podle rubriky 1–4. Nejsou tu body ani konfety. Splnění mění jen stav milníku.
Návrhy: `u-milestone-a-390-in-progress`, `-self-assessment`, `-done`, `u-milestone-a-1440-self-assessment`.
Otevřené: NQ-33 (podmínka splnění), NQ-34 (odměna patří do verzované politiky odměn; v návrhu není žádná částka).

## Nástěnka 3 · Lab

### V · Daňová mapa tranší (Portfolio Lab)
Je to vzdělávací přehled, ne daňové přiznání. Tranše jsou nákupy z append-only obchodní knihy. Datum osvobození a limit berou z registru faktů (`src/features/facts/registry.ts`) a jen přes `factNotice`/fact key. Příjmy z prodejů se počítají hrubé za kalendářní rok. Chybějící data se zobrazí jako nedostupná, nikdy jako nula. Ukázkový výpis je deterministický a označený.
Návrhy: `v-tax-lots-390-empty`, `-practice-portfolio`, `-near-exemption-sample`, `-data-unavailable`, `v-tax-lots-1440-near-exemption`.
Otevřené: NQ-04 (párování prodaných kusů), NQ-37 (ukázkový výpis vs ruční zápis), NQ-38 (zjednodušené daně, bez daňového kurzu).

### W · Karty v okamžiku rozhodnutí
Karty se spouštějí podle explicitních pravidel, nejvýše jedna karta na akci:
- prodej tranše méně než 31 dní před časovým testem,
- pátý obchod v kalendářním týdnu,
- prodej zisku při držení ztráty,
- uložení backtestu po ≥ 10 pokusech.

Karty nikdy nediagnostikují zkreslení jako fakt.
Návrhy: `w-decision-card-390-tax-lot`, `-turnover`, `-disposition`, `-overfitting`.
Otevřené: NQ-39 (prahy jsou návrh, randomizovat a měřit), NQ-40 (ukládání volby „Pokračovat stejně“).

### X · Zpětná vazba k procesu (Portfolio Lab)
Souhrn nahoře na přehledu, kritéria jsou vysvětlitelná. Každé má stav podle explicitního pravidla:
- „V souladu“: odchylka ≤ pásmo,
- „Odchylka“: odchylka > pásmo,
- „Bez dat“: chybí vstup,
- „Informace“: IPS pro kritérium nemá pravidlo.

**Žádné souhrnné skóre.** Výnos, MWR a TWR jsou jen kontext. Bez IPS se ukazuje pozvánka k sepsání plánu.
Návrhy: `x-process-feedback-390-no-ips`, `-on-plan`, `-drift`, `-missing-data`, `x-process-feedback-1440-drift`.
Otevřené: NQ-41 (limit pozice a rozpočet obratu v IPS v3), NQ-42 (MWR/TWR až od delší historie), NQ-44 (sjednotit ukázková čísla a fiktivní fondy).

### Y · Backtest bez sebeklamu (Backtesting Lab)
Počítadlo pokusů pro kombinaci uživatel × strategie × období. Ověření mimo test jde jednou na nastavení. Zahrnuje náklady a zjednodušenou daň a benchmark kupuj a drž. Počítadlo slouží k učení, ne k odměně.
Návrhy: `y-backtest-390-first-attempt`, `-many-attempts`, `y-backtest-1440-many-attempts`.
Otevřené: NQ-43 (opakované ověření mimo test), NQ-38.

## Nástěnka 4 · Postup a opakování

### Z · Pokrok podle dovedností
Záložka Pokrok podle dovedností a milníků: počet dovedností ve stavu Zvládnuté a výš, splatná opakování a milníky. XP je vidět, ale vedlejší, cvičný kapitál jako kontext. Žádné série jako tlak a žádné žebříčky. Potřebuje skill model a plánovač opakování (#122, #123).
Návrhy: `z-progress-390-milestone-a-in-progress`, `z-progress-390-new-user`, `z-progress-1440-milestone-a-in-progress`.
Otevřené: NQ-45 (cvičný kapitál „získáno vs vyplaceno“ předpokládá měsíční výplatu z #139; do té doby ukazovat jen „získáno“), NQ-46 (pokles dovednosti jen v detailu), NQ-47 (pojmy do detailu dovednosti).

## Doporučení z otevřených otázek

Nástěnky ke každé otázce navrhují výchozí řešení. Doporučení nejsou schválení, ale bez jiného rozhodnutí je bere agent jako výchozí:

| NQ | Doporučení |
| --- | --- |
| 20 | Prokázané lekce počítat do postupu, odměnu ani XP nevyplácet. |
| 21 | Pořadí: Pokračovat → opakování → doporučení. |
| 22 | Vstupní test bez zpětné vazby po otázce. |
| 23 | Začít pravidlem „2 správné na dovednost = prokázáno“ a měřit. |
| 24 | Počet správných jen v „Projít úlohy s vysvětlením“. |
| 26 | Úroveň 3 dostupná, ale nedoporučovaná před milníkem A. |
| 28 | Sbalit hotové a vzdálené zamčené úrovně. |
| 29–30 | IPS v krocích s lokálním konceptem; lekce vede do stejného nástroje v Labu. |
| 31 | Hodnotit zvlášť „bez prodeje ve strachu“ a „pásmo použito“, bez souhrnného verdiktu. |
| 32 | Vývoj po rozhodnutí jen na vyžádání, nikdy hodnotit podle výsledku. |
| 33 | Milník A = všech 5 částí + odevzdané sebehodnocení, bez minimální úrovně. |
| 34, 45 | Odměny a výplaty jen přes verzovanou politiku odměn. |
| 37 | Ukázkový výpis hned, ruční zápis skutečných nákupů až po rozhodnutí o soukromí. |
| 39 | Začít s navrženými prahy, karty randomizovat. |
| 40 | Volbu ukládat jen pro uživatele, smazatelnou, nikdy jako hodnocení. |
| 41 | Do IPS v3 volitelný limit pozice a rozpočet obratu. |
| 42 | MWR/TWR až po 6 měsících a 2 peněžních tocích. |
| 43 | Počítat pokusy i na mimo-testovém období. |
| 46 | Pokles dovednosti jen v detailu a v opakování. |
