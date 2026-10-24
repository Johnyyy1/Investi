# 2.4.1 — Kdy musí investor podat daňové přiznání

Implementace [#183](https://github.com/Johnyyy1/Investnik/issues/183). **Redakční koncept, čeká na odbornou revizi; není publikovanou daňovou lekcí.**

- Identita: `taxes-filing-obligation`, úložný modul `module-czech-taxes`, slug `when-to-file`; budoucí URL `/learn/czech-taxes/when-to-file`.
- Umístění: L2, modul 2.4, pořadí 1, povinná, předpoklad `foundations-stocks` (#156), dovednost `tax-filing`. Odhad 12 minut je autorský odhad, nikoli měření s uživateli.
- Výsledek: rozlišit osvobozené příjmy, českou konečnou srážku a započitatelné jiné příjmy; použít příslušnou hranici a oddělit přiznání od oznámení.
- Scénáře: modelové příklady českých rezidentů, běžné investice mimo obchodní majetek. Jana: jediný zaměstnavatel, prohlášení, ETF z roku 2021 prodané za 80 000 Kč v roce 2026 a hrubé zahraniční dividendy 4 000 Kč. Adam: zahraniční dividendy 25 000 Kč. Bára: české dividendy 30 000 Kč. Cyril: jediný prodej ETF za 150 000 Kč po nákupu za 120 000 Kč a držbě jednoho roku.
- Průchod: 14 kroků, předpověď → pravidla → osvobození → řešená Jana → rozhodovací strom → persona A → částečně řešená B → hrubý příjem a rozdíl u C → samostatný závěr C → daňová ztráta → lhůty/oznámení → vybavení → vlastní vysvětlení → zdroje a závěr.
- Používá jen existující typy bloků a sdílený `LessonDraftPreview`; žádný nový renderer. `decisionTree` je nehodnocené procvičení, znalosti ověřují serverově vyhodnotitelné otázky. Každý krok má nejvýše jednu otázku, na konci kroku; poslední žádnou.

## Stav faktů a publikační brána

Lekce je v `draftLessons`, manifest i nový úložný modul jsou `planned`. Veřejný průchod není dostupný (nepřihlášený návštěvník jde na přihlášení, lesson route odmítá nepublikovaný obsah jako not-found), `validateMove` odmítá postup a modul se neseeduje jako dostupný. Náhled `/dev/when-to-file` existuje pouze v `next dev`, neukládá odpovědi, pokrok ani odměny. Zařazení do L2 zachovává budoucí politiku v4 (2 000 Kč při první publikované dokončené lekci), ale koncept žádnou odměnu neuděluje. Stávající identity, kurzory, dokončení, účtenky a přístup do Labu se nemění.

Próza používá tokeny `dan.hranice_priznani`, `dan.casovy_test_cp`, `dan.limit_100k`, `dan.dividendy_cz`, `dan.lhuty_priznani` a `dan.oznameni_5m`. Modelové částky nejsou právní hodnoty. Kontext scénáře je pevně 24. 10. 2026; jeho změna vyžaduje novou obsahovou kontrolu.

Primární orientační kontrola 24. 10. 2026: [Finanční správa — obecné informace DPFO](https://financnisprava.gov.cz/cs/dane/dane/dan-z-prijmu/fyzicke-osoby/obecne-informace), oddíl Podávání daňového přiznání, uvádí obě hranice, vyloučení osvobozených a srážkových příjmů, podmínky zaměstnanecké výjimky i daňovou ztrátu. Doplněna pouze kandidátní hodnota existujícího záznamu `dan.hranice_priznani` pro rok 2026, aby byl návrh čitelný. **Stav `unverified`, `verifiedAt: null` a blokace #134 zůstávají.** Čtení obecné stránky není potvrzením celého výkladu pro prodej CP za rok 2026 ani odbornou revizí.

Před publikací je nutné:

1. Ověřit účinný § 38g pro rok 2026, hrubý příjem u § 10, zahraniční dividendy a hranice včetně rovnosti; revidovat všechny modelové závěry. Konzervativní postup s hrubým příjmem je výslovně označen jako čekající na potvrzení, nikoli vydáván za vyřešený spor.
2. Dořešit blokovaný časový test a výjimky (#134). Jana není hraniční případ výročí; lekce neurčuje datum obchodu vs. vypořádání ani nepáruje tranše.
3. V lednu 2027 ověřit a doplnit termíny přiznání za rok 2026 do `dan.lhuty_priznani`. Návrh zobrazuje neověřený stav a žádná konkrétní data. Historická verze za 2025 se nepřepisuje ani nepoužívá jako lhůta pro příjmy roku 2026.
4. Zaznamenat skutečnou revizi daňovým poradcem podle [workflow](editorial-workflow.md) do [reviews.md](reviews.md) a `content-reviews.ts` s přesnými verzemi faktů. Zatím nebyla provedena. Hlavička nemá vymyšlené datum úplného ověření; po ověření všech tokenů jej odvodí existující renderer. Blok `factNotice` ukazuje vzdělávací upozornění, datované zdroje a čekající fakta již v návrhu.
5. Teprve poté přesunout z `draftLessons` do `authoredLessons`, nastavit modul i lekci `available`, přidat publikační kontrakt, zopakovat gates a validační průchod skutečné persistence. Issue #183 do té doby zůstává otevřené.

Lab bridge odkazuje pouze na existující historii obchodů a výslovně říká, že Lab není daňová evidence. Souhrn ročních prodejů a daňových tranší (#137) ani sezónní zvýraznění plánovaného modulu nejsou předstírány jako hotové.

## Ověření

- `when-to-file.test.ts`: identita, umístění a zamčení konceptu; úplnost kroků; chybná/správná odpověď při přechodu; přepočet persony C ze vstupů a porovnání s hodnotami registru; všechny větve stromu; blokace faktů a nezávislá brána odborné revize.
- `npm run test:tax-filing-browser` na čerstvém `next dev` (port 3183, případně `TAX_FILING_TEST_URL`): 14 kroků, chybná odpověď a oprava, strom, klávesnice, přesun fokusu, žádný POST, neveřejná URL, 320/390/1440 px a 200% text na každém kroku. Snímky každého kroku na 390/1440 px ukládá do `test-results/when-to-file`.
- Žádná migrace ani změna finančního účtování, odměnové politiky nebo persistence. DB/concurrency testy nejsou potřeba pro nepublikovaný koncept; skutečné finanční operace tento návrh neprovádí.

Validační běh 24. 10. 2026: lint, knip, typecheck, 2 149 unit testů ve 202 souborech, check:facts a produkční build prošly. Čerstvý vývojový runtime ověřil celý browser průchod; produkční runtime potvrdil 404 redakčního náhledu. [Snímky všech kroků](lesson-reviews/when-to-file.md) jsou přiloženy pro redakční kontrolu. Fyzická zařízení, čtečka obrazovky a DB/concurrency suite nebyly lokálně spuštěny.
