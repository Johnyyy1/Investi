# Standard lekce 2.0: autorský průvodce

Platí pro nové lekce Investníku a obsahové revize. Cílem je, aby člověk dokázal udělat a zdůvodnit investiční rozhodnutí, rozpoznat omezení a nastavit si pojistku. Samotný výpočet ani výnos v simulaci nejsou důkazem připravenosti investovat skutečné peníze.

Nejdřív si přečti [AGENTS.md](../../AGENTS.md), [slovník UI](../terminology.md) a [smlouvy učení a persistence](../product-reset.md). [Podklad Curriculum 2.0](curriculum-research.md) určuje směr; jeho příklady, výzkumná tvrzení a právní údaje nejsou samy o sobě ověřeným zdrojem. Umístění lekcí a stav implementace ověř v [registru kurikula](../../src/features/learning/curriculum.ts) a v kódu, ne podle počtu lekcí v podkladu.

## 1. Než začneš psát

Do popisu PR nebo pracovního zadání vyplň tento brief. Jde o redakční údaje, nikoli o nová pole typu `AuthoredLesson`.

| Údaj | Co uvést |
| --- | --- |
| Identita | Stabilní `lesson.id`, úložný modul, `moduleSlug` a `slug`; u revize také původní URL. |
| Umístění | Úroveň, zobrazovací modul a kód, pořadí, předpoklady, dovednosti a povinnost podle registru. |
| Výsledek | „Po lekci dokážeš…“ + jedno pozorovatelné rozhodnutí nebo výstup a kritérium správnosti. |
| Vstupní znalost | Co už člověk musí umět; co se zde znovu vysvětlí. |
| Scénář | Česká situace, fiktivní podklady, měna, období, náklady a další předpoklady. |
| Ověření | Otázky, typické chybné úvahy, vlastní vysvětlení a případný výstup hodnocený rubrikou. |
| Přenos | Konkrétní existující místo v Labu, kontrolní seznam nebo úprava investičního plánu. |
| Fakta a revize | Použité klíče faktů, zdroje, platnost, datum ověření, vlastník a požadovaná odborná revize. |
| Kompatibilita | Nová lekce / oprava textu / změna struktury; dopad na kurzor, dokončení, odměny a odemčení. |

Nová běžná lekce míří na **10–15 minut včetně interakcí**. Odhad ověř průchodem; není to minimální délka textu ani důvod natahovat první mini-lekci. Náročnější cíl rozděl do navazujících lekcí. Stávající kratší lekce se kvůli tomuto standardu automaticky nepřepisují.

## 2. Stavba podle cíle

Následující části jsou stavebnice. Konkrétní typy kroků, jejich data, návrhy (PNG) a živý náhled popisuje [katalog typů kroků](lesson-steps.md). Lekci skládej jen z nich a nekresli vlastní UI. Části nemusí mít každá vlastní krok ani se objevit v každé lekci. Jeden krok rozvíjí jednu myšlenku nebo jedno rozhodnutí; vysvětlení má obvykle několik krátkých vět. Dlouhý článek rozdělený tlačítkem Pokračovat není interaktivní lekce.

| Část | Co má člověk udělat | Vhodný blok |
| --- | --- | --- |
| Úvodní problém českého investora | Zvolit postup nebo předpovědět důsledek, ještě než dostane návod. | `paragraph`, `multipleChoiceQuestion` |
| Koncept | Pojmenovat princip potřebný k rozhodnutí. | `explanation`, `conceptCallout`, `formula` |
| Číselný příklad | Projít vstupy → výpočet → jednotky → význam a omezení. | `workedExample` |
| Ukázka | Změnit jeden vstup, předpovědět a odhalit důsledek. | existující `interactiveFigure` |
| Procvičení s oporou | Doplnit část řešení s nápovědou. | `fadedExample`, `numericQuestion` nebo `multiNumericQuestion` |
| Samostatné rozhodnutí | Vyřešit nový případ bez opsání předchozí odpovědi a zdůvodnit volbu. | otázka + výzva k vlastnímu vysvětlení |
| Časté chyby | Rozpoznat konkrétní chybnou úvahu a její důsledek. | `options[].explanation`/`misconception`, `findError`, `conceptCallout` |
| Práce s dokumentem | Najít údaje ve fiktivním výpisu, ceníku nebo KID. | `documentTap` |
| Rozhodnutí s kompromisem | Vyzkoušet volby za personu a vidět důsledky. | `personaDecision` |
| Datovaná fakta | Vidět daňová/regulatorní čísla s datem a upozorněním. | `factNotice` |
| Ověření porozumění | Vybavit si princip v pozměněné situaci, bez řešení na stejném kroku. | krok `kind: "mastery"` s otázkou |
| Napojení na Lab | Najít známý údaj nebo prověřit plán; obchod nemusí být správným dalším krokem. | `labBridge`, `labMission` |
| Vlastní plán | Převést pravidlo na 2–4 věty a porovnat s rubrikou. | `writtenReflection` |
| Shrnutí | Říct si vlastními slovy pravidlo, jeho mez a osobní pojistku. | `lessonSummary`, `takeaway`, `checkpoint` bez hodnocené otázky |

Používej postup **řešený příklad → částečně řešený příklad → samostatná úloha → vybavení principu → krátké vlastní vysvětlení**. Číselná lekce má vysvětlit, jak výsledek mění rozhodnutí, co předpokládá a kdy může mást. Praktická lekce může místo vzorce pracovat s fiktivním ceníkem, dokumentem s klíčovými informacemi (KID), výpisem či kontrolním seznamem.

Modul uzavírá smíšené ověření více dovedností. Praktický projekt na konci úrovně potřebuje předem zveřejněnou čtyřúrovňovou rubriku s pozorovatelnými kritérii. Nevymýšlej souhrnné skóre bez modelu ani univerzální ideální alokaci. `kind: "mastery"` dnes označuje krok ověření; samo nezavádí rozložené opakování ani stav zvládnutí. Ty jsou oddělené od celoživotního dokončení a odměny.

Behaviorální lekce vede přes **zážitek v oddělené simulaci → rozbor rozhodnutí → vlastní pojistku** (např. kontrolní seznam, frekvenci kontroly, pravidlo v IPS). Jedna volba neopravňuje diagnostikovat zkreslení. Krizový nácvik hodnotí dodržení plánu, ne odhad zotavení trhu; scénář nesmí tajně měnit trvalé portfolio.

## 3. Jazyk, příklady a hranice

- Piš česky, přímo a srozumitelně, ve druhé osobě jednotného čísla. Nový termín nejdřív vysvětli; anglický název přidej při prvním výskytu v závorce. Pak používej český název ze [slovníku](../terminology.md). Zavedené zkratky ETF, TER nebo IPS vysvětli, nevytvářej jejich české náhražky.
- Částky uváděj v **Kč**, s desetinnou čárkou a oddělením tisíců: `10 000 Kč`, `0,25 %`. Procenta rozlišuj od procentních bodů (`p. b.`). Ve zdrojovém TypeScriptu zůstává desetinná tečka; kanonické účtování používá centrální přesnou aritmetiku a celé nejmenší měnové jednotky.
- Používej fiktivní firmy, fondy, brokery a nabídky bez existujících značek: „Firma A“, „Fond B“, „Nabídka A“. Nedoplňuj skutečná loga ani doporučené produkty. Výjimkou je řádně označený historický dataset, kde skutečnou identitu zachovej kvůli dohledatelnosti; není to modelová nabídka ani doporučení.
- Označení dej viditelně k příkladu či grafu: **Modelový příklad** pro vymyšlená čísla, **Historická data** pro dohledatelná pozorování, **Simulace** pro modelový průběh. U deterministických dat doplň „Deterministická ukázková data“. Nikdy je neoznačuj jako živá nebo aktuální. Historická simulace musí odlišit vstupní data od modelového výsledku.
- U dat napiš zdroj, období, měnu, frekvenci, úpravu cen (surové / po splitech / včetně distribucí), náklady a limity. Nevydávej cenový výnos za celkový výnos ani příspěvek cvičného kapitálu za zisk. Chybějící údaj je nedostupný, není nula.
- Rozhodnutí vztahuj k podmínkám modelu: „V tomto příkladu má nabídka A nižší uvedený poplatek.“ Nepiš „Kup tento fond“, „Tento broker je nejlepší“ ani sliby budoucích výnosů. Samotný disclaimer neopravuje doporučující text.
- Učení odměňuje pochopení a proces. Za obchod, častější aktivitu, vyšší riziko ani výnos se neudělují XP nebo cvičný kapitál. Žádné pořadí investorů podle výnosu ani pobídky obchodovat kvůli neaktivitě.

Otázka musí mít dostatek vstupů, jednotky, období a pravidlo zaokrouhlení. Distraktory mají představovat skutečné chybné úvahy, ne slovní pasti. Správná zpětná vazba vysvětlí důvod a důsledek; chybná pojmenuje přehlédnutý krok a umožní nový pokus. Nevysmívá se a nehodnotí člověka. Řešení nedávej vedle samostatné ověřovací otázky před odpovědí.

## 4. Fakta, tokeny a redakční stav

Daňové, regulatorní, makroekonomické a výzkumné údaje patří do datovaného registru podle [#132](https://github.com/Johnyyy1/Investi/issues/132). Registr je v [registry.ts](../../src/features/facts/registry.ts); lekce jeho hodnoty zobrazuje blokem `factNotice` nebo tokeny v textu. Lekce je má vkládat přes tokeny, například `{{dan.casovy_test_cp}}`, nikoli kopírovat sazby a limity do prózy nebo do správných odpovědí. Každý klíč potřebuje hodnotu a jednotku, jurisdikci, právní základ, platnost od–do / zdaňovací období, primární zdroj URL, datum a stav ověření, vlastníka a příští revizi. U výzkumu přidej vzorek, období a omezení přenosu na Investník.

Registr a serverový renderer z #132 popisuje [průvodce datovanými fakty](facts.md). Kontrola všech publikovaných lekcí běží v CI a před buildem: neznámý, neověřený nebo redakčně blokovaný token nesmí být publikován. Historická lekce určuje datum pravidla přes `factContext.asOf`; daňová lekce se označí `factContext.kind: "tax"`. Nevyřešené závislosti ponech jako nepublikovaný návrh mimo `authoredLessons`; neobcházej je číslem napsaným natvrdo. Vymyšlené vstupy jasně označeného modelového příkladu token nepotřebují. Odborné schválení a evidence revizí zůstávají v [#133](https://github.com/Johnyyy1/Investi/issues/133). Kontroly kompatibility z #119 popisují [pravidla publikovaných lekcí](published-lesson-compatibility.md).

Publikovaná daňová lekce musí viditelně uvést **„Vzdělávací obsah, ne daňové poradenství; stav k [datum]“** a nesmí obsahovat neověřené či nevyřešené pravidlo. Datum se odvozuje od ověření použitých faktů, ne od data commitu. Před publikací vyžaduj odbornou revizi daňovým poradcem se záznamem role, data a kontrolované verze faktů; konkrétní evidenci a CI řeší #133. Obecný obsah potřebuje redakční revizi. Nehotovou revizi výslovně zaznamenej a obsah nepublikuj.

Historický scénář používá pravidlo platné k datu scénáře. Odlišuj cenné papíry a krypto, příjem z prodeje a zisk, kurz pro obchod a pro daně a jednotlivé daňové tranše. Překročení termínu revize potřebuje redakční příznak a případné viditelné upozornění podle politiky registru. Kalendář údržby patří do #133; tento standard nevytváří automatické připomínky.

## 5. Technický kontrakt a identita

Kanonické typy jsou [AuthoredLesson, LessonBlock a StepDefinition](../../src/features/lessons/types.ts). Obsah je v `blocks`; pořadí obrazovek určuje mapa kroků v [steps.ts](../../src/features/lessons/steps.ts). `sections` jsou metadata, nikoli definice průchodu. Jako referenci čti [Foundations](../../src/features/lessons/foundations/content.ts), [Volatilitu](../../src/features/lessons/volatility/annualising-volatility.ts) a její [flow.ts](../../src/features/lessons/volatility/flow.ts).

Třídění, řazení, jednoduché hledání v dokumentu a ukládání checklistů či sebehodnocení doplňuje [rozšíření lesson enginu #121](lesson-exercises.md).


- Nové stabilní ID má tvar **`<modul>-<tema>`**, ASCII kebab-case, např. `costs-comparing-fees`; modul znamená stabilní identitní prefix, nikoli zobrazovací kód `2.2`. Existující ID nikdy nepřejmenovávej podle této konvence. ID musí být unikátní v celém kurikulu; ID bloků, možností a polí musí být unikátní v příslušném rozsahu.
- Po publikaci neměň `lesson.id`, úložné `module_id`, `moduleSlug`, `slug` ani URL. Zobrazovací umístění měň v `lessonPlacements`; politika v4 určuje nové odměny podle registrované úrovně, proto změnu jejího dopadu na budoucí odměny posuzuj výslovně. Historické účtenky se nepřepočítávají. Nová témata dostávají vlastní identitu, nekopírují identitu jiné lekce.
- **Nejvýše jedna hodnocená otázka na krok. Poslední krok žádnou hodnocenou otázku nemá.** Platí pro `multipleChoiceQuestion`, `numericQuestion`, `multiNumericQuestion`, `fadedExample`, `documentTap` i `findError`. Více souvisejících polí v jednom `multiNumericQuestion` je jedna otázka; dvě nezávislé úlohy rozděl do kroků. Textové vlastní vysvětlení se automaticky nehodnotí. Pro uložený výstup se sebehodnocením použij `rubricSelfAssessment`; krok vyžaduje odevzdání, nikoli určitou úroveň hodnocení.
- Každý odkaz z kroku musí směřovat na existující blok. Nenechávej otázky mimo průchod, nevkládej tutéž otázku do více kroků. Výběrová otázka má právě jednu správnou existující možnost. Číselná odpověď má konečnou hodnotu, nezápornou toleranci a jednotku.
- Použij existující typ bloku z [katalogu](lesson-steps.md) a podporované `interactiveFigure.figure`. Nový renderer, ukládání výstupů, hodnocení nebo pole manifestu jsou implementační změna se samostatnou validací. Nevymýšlej vlastnosti, které runtime nečte. Psaný výstup (`writtenReflection`) ani text v `labMission` se zatím neukládají.
- `labBridge.metric` je volitelné existující `MetricId`; přidá odkaz na metriku. Odkazuj pouze na dostupnou funkci a popiš její skutečné konvence. Není nutné nutit člověka k nákupu; plánovanou funkci nepopisuj jako hotovou.

Server v [transition.ts](../../src/features/progress/transition.ts) kontroluje správnou odpověď při přechodu vpřed. Dokončení vyžaduje poslední uložený krok, ne nový kvíz. Odpovědi a vstupy explorerů jsou dnes pomíjivé; ukládá se kurzor a dokončení. Zachovej smyčku odpověď → zpětná vazba → uložené pokračování → dokončení → jednorázová odměna → další krok.

### Změna již publikované lekce (#119)

`last_position` je index kroku. Zachování ID samo nestačí: vložení před něj může změnit význam uloženého pokroku.

Tabulka `lesson` už má `content_version`, ale `lesson_progress` dnes verzi obsahu nesleduje a přechody ji neporovnávají. Samotné zvýšení této hodnoty tedy nepřemapuje uložený kurzor. [Pravidla kompatibility publikovaných lekcí](published-lesson-compatibility.md) a jejich regresní testy chrání existující průchody; nekompatibilní revize stále potřebuje samostatně navrženou migraci nebo nové ID.

| Změna | Pravidlo |
| --- | --- |
| Překlep nebo zpřesnění vysvětlení | Zachovej strukturu, identitu, význam již zodpovězených otázek a platnost odpovědí. Změnu výpočtu či správné odpovědi posuzuj jako obsahovou změnu. |
| Přidání kroku | Bez verzování připadá v úvahu pouze nehodnocený krok těsně před posledním. I ten posune index dosavadního závěru: před vydáním dolož test rozpracované lekce včetně uživatele na původním posledním kroku. Výjimka není automatický důkaz bezpečnosti. |
| Přidání hodnocené otázky, změna pořadí, významu kroku nebo odpovědi | Vyžaduje výslovný plán kompatibility a podle potřeby verzi obsahu / samostatnou aditivní migraci. Dokud není mechanismus implementovaný a otestovaný, strukturální revizi nepublikuj. Nové téma může být samostatná nová lekce s vlastním ID. |
| ID bloků používaných při přechodu | Neměň je ani nepřesouvej otázky přes uložený kurzor. Neměň je kvůli kosmetické úpravě názvu. |
| Dokončená lekce a rozšířený modul | `completed` i původní čas zůstávají. Nový obsah může změnit stav modulu, ne přepsat historii. Opakování a zvládnutí jsou oddělené; nepřepočítávají účtenky ani znovu neudělují odměnu. |
| Rozšířený checkpoint | Stávající publikovaný průchod ponech; nové ověření přidej jako samostatnou položku systému zvládnutí, až bude implementovaný. |

Zachovej záznamy odemčení Labu, XP, cvičný kapitál i verze historických účtenek. Prerekvizity Labu zůstávají původních sedm lekcí Foundations a 420 XP, i pro uživatele bez záznamu odemčení. Nové lekce L1 ani Checkpoint 1 je nerozšiřují. Nově publikovaná lekce potřebuje vlastní kontrakt v `published-lessons-v1.json`; původní záznamy zachovej. Spusť i `test:curriculum-compatibility` na izolované QA databázi.

## 6. Šablony a zapojení do produktu

V repozitáři jsou kopírovatelné soubory [lesson.ts.template](templates/lesson.ts.template) a [lesson.test.ts.template](templates/lesson.test.ts.template). Obsahují fiktivní porovnání poplatků, částečně řešený příklad, samostatnou úlohu, rozhodnutí a závěr. Jsou pouze vzor, nejsou registrovanou ani publikovanou lekcí a neimplementují poplatky Labu. Částky jsou vstupy modelu, nikoli právní či tržní fakta. Přípona `.template` je drží mimo aplikační TypeScript a kontrolu nepoužitého kódu; ověřují se až jako zkopírované soubory `.ts`.

Pro vyzkoušení šablony z kořene repozitáře (cílová složka musí být nová):

```sh
mkdir src/features/lessons/authoring-sandbox
cp docs/education/templates/lesson.ts.template src/features/lessons/authoring-sandbox/lesson.ts
cp docs/education/templates/lesson.test.ts.template src/features/lessons/authoring-sandbox/lesson.test.ts
npm test -- src/features/lessons/authoring-sandbox/lesson.test.ts
npx next typegen
npm run typecheck
```

Vitest v tomto repozitáři standardně hledá testy v `src`, ne v `docs`. Samotná zelená šablona proto neznamená ověřenou publikaci. Složku použij pro skutečnou novou lekci nebo před commitem odstraň pouze tyto vlastní zkušební kopie; nic neregistruj jen pro zkoušku.

Při implementaci skutečné lekce:

1. Zkopíruj soubory do příslušného `src/features/lessons/<modul>/`, přejmenuj exporty, soubory, ID a všechny modelové vstupy. Zachovej typování; neobcházej jej přetypováním na `any`.
2. Do manifestu modulu přidej metadata s `status: "planned"`. Autorský návrh ponech mimo `authoredLessons` a aktivní mapu kroků, dokud není připravená publikace; test integrity vyžaduje shodu dostupných a registrovaných lekcí.
3. Připrav umístění, existující předpoklady a dovednosti podle skutečného obsahu; tyto údaje nepatří do `AuthoredLesson`. U stávajícího modulu nezměň jeho identitu. Aktivní `lessonPlacements` zatím obsahují právě dostupné lekce, proto umístění návrhu zatím ponech v briefu.
4. V publikačním PR společně nastav `status: "available"`, přidej obsah do [registry.ts](../../src/features/lessons/registry.ts), kroky do mapy modulu a novou mapu do `moduleSteps`, pokud modul ještě žádnou nemá. U nového úložného modulu doplň `storageModules` v registru kurikula. Zapiš umístění do `lessonPlacements` a případné nové dovednosti do `skills`. Doplň skutečné předchozí/následující odkazy. Každá dostupná lekce má právě jeden obsah, průchod i umístění. Dokonči požadované revize a závislosti před změnou stavu.
5. Publikované řádky v DB vytváří idempotentní [seedCurriculum](../../src/db/curriculum.ts). Ověř `db:check-curriculum` a `test:curriculum-seed` na izolované QA databázi; nemaž běžnou vývojovou DB. Změna katalogu se sama nerovná připravené DB.
6. Spusť relevantní kontroly níže a vyplň checklist. Vyhodnoť i odměnu podle registrované úrovně a zachování původních prerekvizit Labu, zejména při přidání lekce L1.

## 7. Testy, které autor dodává

Vzor vychází z [volatility-lessons.test.ts](../../src/features/lessons/volatility/volatility-lessons.test.ts). **Každou číselnou odpověď přepočítej z původních vstupů zadání**, včetně všech polí `multiNumericQuestion` a číselných porovnání ve výběrových otázkách. Ověř i hodnoty řešeného příkladu. Nekopíruj do očekávání pouze stejné výsledné číslo a nepočítej očekávanou odpověď ze samotné `question.answer`. Test používá explicitní vstupy ze zadání; reviewer porovná, že se zadání a vstupy shodují.

- Výpočet: jednotky, období, frekvence, náklady, zaokrouhlení, toleranci a smysluplnou chybnou odpověď. Pokud existuje sdílená doménová funkce, ověř shodu s jejími konvencemi a nezávislým jednoduchým výpočtem. Vyhodnocení musí přijmout správnou odpověď v českém zápisu a odmítnout prázdnou, chybnou a odpověď mimo toleranci.
- Struktura: jedinečná ID, platné odkazy kroků, pokrytí bloků, žádná opakovaná otázka, nejvýše jedna otázka na krok, žádná v závěru, alespoň jedno ověření a platné možnosti. Vzorce musí projít KaTeX s `throwOnError` a `strict: "error"`, pokud je lekce má.
- Zapojení: dostupná lekce odpovídá manifestu, obsahu, průchodu, umístění a navigaci. Spusť [registry.test.ts](../../src/features/lessons/registry.test.ts), [curriculum.test.ts](../../src/features/learning/curriculum.test.ts) a [transition.test.ts](../../src/features/progress/transition.test.ts): server nepřeskočí hodnocený krok bez správné odpovědi, nepovolí skok vpřed a dokončí až z uloženého závěru.
- Fakta: spusť `npm run check:facts` a testy podle [průvodce](facts.md); ověř existující klíče, stav ověření a platnost pro datum scénáře, datum v hlavičce a zastaralost. #133 má zajistit kontrolu odborné revize; do její implementace je odborné schválení výslovná blokující položka review, nikoli tvrzení o existujícím CI.
- Kompatibilita: při změně publikovaného průchodu přidej scénáře starého rozpracovaného i dokončeného uživatele; zachovej dokončení, původní časy, účtenky a přístup. Při finanční nebo perzistenční změně platí přesná aritmetika, idempotence a souběžné testy podle AGENTS.md.

U skutečné publikace spusť `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, relevantní testy persistence a prohlížečový průchod proti čistému runtime. Pro samotnou dokumentaci stačí audit diffu, odkazů a konzistence; změnu šablony navíc ověř zkopírováním a spuštěním jejího testu. Browser ověří chování, které čistý unit test neověří: odpověď, chybu a opravu, Pokračovat, obnovení uloženého kroku, dokončení, review a přechod dál.

## 8. Checklist pro review obsahu

Tento checklist použij v PR; redakční workflow, evidence revizí a kalendář údržby navazují v #133. Nezaměňuj tento seznam za již provedenou odbornou revizi.

- [ ] Brief říká, jaké rozhodnutí nebo výstup lekce učí a jak se ověří; předpoklady a umístění odpovídají registru.
- [ ] Průchod se vejde do 10–15 minut nebo má zdůvodněnou výjimku; kroky jsou krátké, interakce je podstatná.
- [ ] Příklad s řešením přechází v úlohu s oporou a samostatnou úlohu; ověření neprozrazuje odpověď a obsahuje vlastní vysvětlení.
- [ ] Čeština, první vysvětlení termínů, Kč, jednotky a slovník jsou konzistentní; nabídky a firmy jsou fiktivní, historické identity dohledatelné.
- [ ] Každý příklad nebo graf má správný štítek, předpoklady, zdroj/období a omezení; žádné tvrzení o živých datech u fixture.
- [ ] Text neobsahuje doporučení produktu, slib výnosu ani tlak obchodovat; hodnotí proces a připouští ponechat plán.
- [ ] Právní, regulatorní a výzkumné údaje mají ověřené primární zdroje, platnost a tokeny; nevyřešené závislosti brání publikaci.
- [ ] Daňová lekce má požadovaný viditelný text s datem a doloženou odbornou revizi konkrétní verze faktů.
- [ ] Každá číselná odpověď i řešený příklad se přepočítávají ze zadání; chyby, jednotky a tolerance jsou otestované.
- [ ] ID, manifest, registry a kroky souhlasí; nejvýše jedna hodnocená otázka na krok a žádná v závěru; odkazy a vzorce fungují.
- [ ] U revize publikované lekce je doložena kompatibilita kurzoru; dokončení, původní časy, odměny a záznamy odemčení zůstávají zachované.
- [ ] Napojení na Lab odpovídá existující funkci a konvencím; scénář nezasahuje trvalé portfolio a neuděluje odměny za obchod.
- [ ] Ovládání funguje klávesnicí s viditelným focusem; vstupy mají popisky, zpětná vazba není jen barevná a graf má textový ekvivalent. Průchod funguje s omezeným pohybem, na 320/375/390/768/1024/1440 px a při 200% textu bez vodorovného přetečení.
- [ ] PR uvádí skutečně provedené kontroly a jejich výsledky, revizora a vlastníka další údržby; neprovedené kontroly nejsou označeny jako hotové.
