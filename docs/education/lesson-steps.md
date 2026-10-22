# Typy kroků lekce: katalog pro autory a agenty

Lekce se skládají **výhradně** z typů bloků v [`types.ts`](../../src/features/lessons/types.ts). Každý typ má hotový renderer v [`src/components/lesson`](../../src/components/lesson) a schválený návrh v [`docs/design/lesson-steps`](../design/lesson-steps). Při tvorbě lekce nekresli nové UI, nepřidávej styly ani nové komponenty: vyber typ kroku z tohoto katalogu a vyplň jeho data. Když lekce potřebuje typ, který tu není, zastav se a napiš to do PR jako navazující práci.

- **Živý náhled:** `npm run dev` → [`/dev/lesson-steps`](http://localhost:3000/dev/lesson-steps). Každý typ na referenčním obsahu včetně Zkontrolovat → zpětná vazba → Zkusit znovu.
- **Referenční data:** [`specimens/time-test.ts`](../../src/features/lessons/specimens/time-test.ts). Kopíruj odsud tvar dat, ne text.
- **Zdroj návrhů:** Pen soubor `investi-design.pen`, nástěnky F–N a „00 · Nové komponenty“. PNG v repozitáři jsou exporty z 21. 10. 2026. Kdo nemá Pen, řídí se PNG.

## Jak vybrat typ kroku

| Co má člověk v kroku udělat | Typ (`type`) | Hodnocený | Návrh |
| --- | --- | --- | --- |
| Projít vzorový postup | `workedExample` | ne | B · Obsahové bloky (Pen) |
| Doplnit poslední řádek postupu (most k samostatné úloze) | `fadedExample` | ano | `f-faded-example-*` |
| Vybrat odpověď; distraktory jsou známé chybné představy | `multipleChoiceQuestion` + `options[].explanation`/`misconception` | ano | `g-choice-per-option-*` |
| Spočítat číslo | `numericQuestion` / `multiNumericQuestion` | ano | C · Otázky (Pen) |
| Najít údaje ve výpisu, ceníku, KID, přehledu | `documentTap` | ano | `h-document-*` |
| Zkontrolovat cizí výpočet a opravit chybu | `findError` | ano | `i-find-error-*` |
| Rozhodnout kompromis za personu, bez jedné správné odpovědi | `personaDecision` | ne | `j-persona-*` |
| Vyzkoušet si něco v Labu a vrátit se k rozboru | `labMission` | ne | `k-lab-mission-*` |
| Vidět datovaná daňová/regulatorní čísla a upozornění | `factNotice` | ne | `l-tax-notice-*` |
| Převést pravidlo na vlastní plán, 2–4 věty | `writtenReflection` | ne | `m-written-response-*` |
| Změnit vstup a pozorovat důsledek | `interactiveFigure` (jen existující `figure`) | ne | D · Kontejner (Pen) |

Doporučený průchod podle [standardu lekce](lesson-standard.md): `workedExample` → `fadedExample` → samostatná otázka → `kind: "mastery"` (často `documentTap` nebo `findError`) → `personaDecision` nebo `labMission` → `writtenReflection` → `lessonSummary`.

## Pravidla platná pro všechny hodnocené typy

`fadedExample`, `documentTap` a `findError` jsou otázky stejně jako výběr a číslo. Platí pro ně:

- **Nejvýše jedna hodnocená otázka na krok, vždy poslední blok kroku; poslední krok lekce žádnou nemá** ([steps.test.ts](../../src/features/lessons/steps.test.ts)).
- Server je při přechodu vpřed znovu vyhodnotí ([transition.ts](../../src/features/progress/transition.ts)). Odpověď se posílá jako `Record<string, string>` s nejvýše 10 klíči a 100 znaky na hodnotu. Proto mají řádky dokumentu krátká ID (`b1`, `s1`).
- Správnou odpověď ve testech ber z [`answer-keys.ts`](../../src/features/lessons/answer-keys.ts). Nový hodnocený typ musí přibýt v `evaluateQuestion`, `feedbackFor` i `answer-keys` současně.
- Zpětnou vazbu kreslí sdílená karta: „Správně“ / „Zkus to ještě jednou“, volitelně řádek „Častá záměna: …“. Nevymýšlej vlastní nadpisy ani barvy.

## Typy podrobně

### F · `fadedExample` — dokonči příklad

Vyplněné řádky (`steps`) + jeden prázdný (`blank`): buď `input: "choice"` s `options`/`correctOptionId`, nebo `input: "number"` s `answer`/`tolerance`/`unit`. `misconception` se zobrazí při chybě, pokud zvolená možnost nemá vlastní. Použij pro postupy o 3–6 řádcích. Data, počty dní a částky v řádcích musí test přepočítat ze vstupů.

![F · špatně](../design/lesson-steps/f-faded-example-390-wrong.png)

### G · výběr s vysvětlením ke každé možnosti

Běžný `multipleChoiceQuestion`. Každá **špatná** možnost může mít `explanation` (co přesně je na té úvaze špatně) a `misconception` (krátký štítek). Bez nich se použije společné `incorrectExplanation`, takže starší otázky fungují beze změny. Správná možnost se po chybě neprozrazuje.

![G · zvolena špatná A](../design/lesson-steps/g-choice-per-option-390-wrong-a.png)

### H · `documentTap` — dokument, klepni na správné místo

`document.columns` popisují tabulku. Na desktopu jsou vidět všechny sloupce. Na mobilu jen sloupce s rolí `mobile`: `title`, `subtitle`, `value` a `detail`. `mobileLabel` přidá předponu, třeba `×` nebo `popl.`. Údaje společné všem řádkům (ISIN, měna) dej do `meta`. Každý řádek má `note`, tedy důvod zobrazený po vyhodnocení. Stav („Správně“, „Chybí“, „Navíc“, „Správně neoznačeno“) se dopočítá sám. Řádek, který se nemá označovat (např. prodej), má `selectable: false`. Dokument je vždy fiktivní (Broker Ukázka, ISIN `XX00…`).

![H · 1440](../design/lesson-steps/h-document-1440-evaluated.png)

### I · `findError` — najdi chybu

`rows` + `errorRowId` + `fixes`/`correctFixId`. `correction` u řádku se ukáže po správném vyřešení: u chybného řádku jako oprava přeškrtnuté hodnoty, u navazujících řádků jako opravený výsledek. Výpočet má právě jednu chybu.

![I · vyřešeno](../design/lesson-steps/i-find-error-390-correct.png)

### J · `personaDecision` — rozhodnutí za personu

Nehodnotí se. `persona.facts` ukazují data i dopočítané lhůty vedle sebe, aby rozhodnutí nestálo na počítání z hlavy. Každá možnost má `consequence` s `lead` (krátký výsledek), vysvětlením a řádky výpočtu. Ilustrativní sazby uveď v `disclaimer`. Avatar je výřez existující pózy průvodce, nikdy nová kresba.

![J · 1440](../design/lesson-steps/j-persona-1440-choice-a.png)

### K · `labMission` — mise v Labu

`mission.target` smí být jen existující oblast Labu (`/lab/portfolio`, `/lab/backtesting`, `/lab/compare`) a cíl mise musí jít v Labu dnes opravdu udělat. Lab se otevře v nové kartě, lekce zůstane na kroku. Data z Labu se do lekce zatím nevracejí, proto rozbor (`analysis`) vždy ukazuje **modelového investora** se štítkem „Ukázková data“. Návrh „Daňová mapa tranší“ je náčrt budoucí funkce: nepiš misi, jako by existovala.

![K · zadání](../design/lesson-steps/k-lab-mission-390-brief.png)

### L · `factNotice` — daňový a regulatorní blok

`factKeys` odkazují do [registru faktů](../../src/features/facts/registry.ts). Čísla nikdy nepiš natvrdo do textu ani do bloku. Blok vypíše hodnoty, původ a upozornění „Vzdělávací obsah, ne daňové poradenství“. Blok vybírá verzi faktu platnou v den zobrazení. Neověřený (`unverified`) nebo redakčně blokovaný (`publicationBlockedBy`) fakt ukáže klidně, šedě a s hodinami; publikovaná lekce ho ale obsahovat nesmí, stejně jako u tokenů to hlídá `npm run check:facts`. Lekce s `factNotice` dostane na prvním kroku štítek „Stav k …“, který se odvozuje od nejstaršího ověření. Nový fakt přidej do registru podle [průvodce datovanými fakty](facts.md); bez ověření primárním zdrojem zůstává `unverified`.

![L · blok](../design/lesson-steps/l-tax-notice-390-header-and-block.png)

### M · `writtenReflection` — krátký psaný výstup

`prompt`, `rubric` (3–4 pozorovatelná kritéria) a `sampleAnswer`. Nejde o body ani o hodnocení správně/špatně. Před odesláním je rubrika vidět jako „Na co myslet“, po odeslání si ji člověk sám odškrtne a uvidí ukázkovou odpověď. Text se zatím **neukládá**. Nejvýše jednou za lekci, obvykle před shrnutím.

![M · odesláno](../design/lesson-steps/m-written-response-390-submitted.png)

## Co z návrhů ještě není v kódu

- **N · Konec lekce a Denní opakování** (`n-*.png`): potřebují model stavu dovednosti a plánovač opakování (#122, #123). Dokud nejsou, zůstává současná závěrečná obrazovka. Nestav je jako součást lekce.
- **Data z Labu v misi** (NQ-01, NQ-02) a **daňová mapa tranší v Labu**: finanční doménová práce mimo lekce.
- **Ukládání psaných odpovědí** (NQ-11) a **promítnutí rubriky do zvládnutí** (NQ-12).
- **Tokeny faktů v textu** (`{{klíč}}`) a redakční workflow ověření (#132, #133). Registr je zatím minimální a jeho fakta čekají na ověření.

Otevřené otázky NQ-01 až NQ-19 jsou popsané na nástěnkách v Pen souboru. Obrazovky mimo lekce (mapa Učení, vstupní test, IPS, krizový nácvik, daňová mapa, Pokrok…) jsou v [obrazovkách produktu P–Z](../design/product-screens.md).

## Komponenty (00 · Nové komponenty)

Exporty v [`docs/design/lesson-steps/components`](../design/lesson-steps/components) ukazují stavební prvky: lišty, zpětné vazby, řádky výpisu, kartu persony, daňový blok a štítek, zaškrtávátko rubriky. Většina z nich je v kódu součástí rendereru příslušného typu. Škála dovednosti a štítek lekce patří k části N a v kódu zatím nejsou.
