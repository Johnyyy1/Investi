# Lekce 0.1.1: rozpočet a míra úspor

Autorský a implementační brief k #148. Před sloučením vyžaduje redakční kontrolu obsahu; tato poznámka není záznam odborného schválení.

- Identita: `before-investing-budget`, modul `module-before-investing`, URL `/learn/before-investing/budget`. Nová lekce, žádné přepisování existujících kurzorů.
- Umístění: L0, modul 0.1, pořadí 1, doporučená, bez předpokladů. Dovednosti `monthly-budget` a `savings-rate`.
- Výsledek: spočítat přebytek z čistého příjmu a všech výdajů; zahrnout měsíční podíl ročních plateb a vysvětlit, proč přebytek není automaticky investovatelný.
- Vstupní znalost: žádná. Výklad vysvětluje čistý příjem, fixní, variabilní a nepravidelné výdaje.
- Scénář: fiktivní Petra (26, Brno), příjem 38 000 Kč, běžné výdaje 30 000 Kč, roční pojištění a servis 7 200 Kč. Vše označeno jako modelový příklad. Výsledky 21,1 %, 600 Kč/měsíc, 7 400 Kč a 19,5 %.
- Ověření: výpočet míry úspor, doplnění měsíčního podílu ročních výdajů, osm tříděných položek, samostatné rozhodnutí za Tomáše, vybavení postupu a dobrovolné vlastní vysvětlení s rubrikou.
- Přenos: seznam ročních plateb, kontrola výpisů za více měsíců a realistický trvalý příkaz podle účelu. Žádný obchod, přenos do IPS ani změna portfolia.
- Soukromí: kalkulačka používá pouze lokální React stav; žádné odesílání, localStorage, telemetry ani ukládání výsledku. Osobní hodnoty nejsou odpovědi lesson enginu. Ukládá se standardní kurzor a dokončení.
- Odměny: existující politika v4 na main z #120 znamená pro L0 pouze XP a nulový cvičný kapitál. Tato lekce ji nemění; staré v1–v4 účtenky, odemčení a podmínky Foundations zůstávají zachované.
- Navazující 0.1.2 (#149) zatím není publikovaná. Závěr to výslovně uvádí; nevytváří odkaz na neexistující lekci. Až bude dostupná, navázání vyřeší běžné pokračování v modulu.

## Model kalkulačky

Vstupy jsou čistý měsíční příjem, fixní a variabilní měsíční výdaje a součet nepravidelných výdajů za rok. `roční / 12` se přičte právě jednou. Míra úspor je přebytek / příjem, v UI vyjádřená v %. Záporný přebytek zůstává záporný; při nulovém příjmu je míra úspor neurčitelná. Prázdná, záporná, nekonečná či příliš velká hodnota nahradí výsledek vysvětlenou chybou. Horní vstupní mez 1 miliarda Kč je technická mez této výukové pomůcky, nikoli finanční doporučení. Výpočty se nezaokrouhlují před zobrazením a nejsou účetnictvím Labu.

## Zdroje a revize

Kontrola zdrojů 22. 10. 2026, vlastník: správce kurikula. V lekci nejsou daňové sazby, tržní údaje ani výzkumná tvrzení; žádné datované faktové klíče nejsou potřeba. Modelové částky nejsou české statistické průměry ani doporučené limity.

- [MF ČR: Standard finanční gramotnosti (2017)](https://mf.gov.cz/cs/ministerstvo/media/aktuality/2017/standard-financni-gramotnosti-29163) – rozpočet, plánování, příjmy a výdaje. Rámec pro školy, nikoli důkaz účinnosti této lekce u dospělých.
- [Investor.gov: Introduction to Investing](https://www.investor.gov/introduction-investing) – obecné plánování, cíle a rezerva; americké produktové a daňové údaje se nepřebírají.

Před zveřejněním má redakční reviewer ověřit srozumitelnost kategorií, přiměřenost odhadu 12 minut a hranici mezi odkládáním peněz a investicí. Žádné individuální investiční ani daňové doporučení se nevydává.

## Validace

`npm run test:budget-browser` prochází skutečnou lekci na čerstvém runtime a izolované lokální DB. Testuje chybu → vysvětlení → opravu, obnovení kurzoru, všech osm kategorií, soukromí síťových požadavků a úložišť, klávesnici a viditelný fokus, 320/390/1440 px, kalkulačku při 200% základním textu a jednorázovou XP-only účtenku bez odemčení Labu. Snímky každého kroku při 390/1440 px ukládá do `test-results/budget` (necommitují se); CI je ukládá s ostatními browser artefakty.
