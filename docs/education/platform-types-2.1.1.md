# 2.1.1 — Typy investičních platforem

Implementace [#165](https://github.com/Johnyyy1/Investnik/issues/165). **Redakční koncept s regulatorním obsahem, čeká na odbornou revizi; není publikovanou lekcí.**

- Identita: `broker-platform-types`, nový úložný modul `module-broker-and-account` (slug `broker-and-account`), slug `platform-types`; budoucí URL `/learn/broker-and-account/platform-types`.
- Umístění: L2, modul 2.1, pořadí 1, povinná, předpoklad `foundations-funds` (#162), dovednost `platform-types`. Odhad 11 minut je autorský odhad, nikoli měření s uživateli.
- Výsledek: rozlišit brokera (execution-only), robo-poradce/správu portfolia, banku či fondovou platformu a penzijní společnost podle toho, kdo rozhoduje, co člověk vlastní a jak se platí; zvolit typ podle vlastního plánu.
- Scénář: modelové příklady. Ondřej investuje 3 000 Kč měsíčně, Jana chce správu předat. Nabídky A–H, X a Y jsou smyšlená písmena, takže nekolidují s existujícími značkami. Žádná značka ani produkt se nedoporučuje.
- Průchod: 13 kroků, předpověď → přehled typů → smluvní strana (aplikace ≠ broker) → třídění 8 nabídek → kdo rozhoduje → evropský pas → náklady a dvě chybné úvahy → persona → srovnání poplatků měsíčně vs. jednorázově → kritéria výběru → ověření bez nápovědy → vlastní vysvětlení → zdroje a shrnutí.
- Třídění *(PLATFORM-04)* používá existující `categorizeQuestion` z #121, není potřeba MVP náhrada. Ostatní typy jsou existující bloky a sdílený `LessonDraftPreview`. Každý krok má nejvýše jednu otázku, na konci kroku; poslední žádnou.
- Odchylka od tabulky v issue: DIP není samostatný typ poskytovatele, ale režim smlouvy, který může nabízet broker, banka, správce i penzijní společnost. Lekce to výslovně říká; čtvrtá kategorie je proto „Penzijní společnost“.

## Fakta a publikační brána

Krok o evropském pasu je regulatorní obsah (notifikace, domovský dohled, ochrana majetku podle domovského státu), proto lekce nese `factContext.kind: "regulatory"` a podle [redakčního workflow](editorial-workflow.md) vyžaduje odbornou revizi. Lekce je v `draftLessons`, manifest i nový modul jsou `planned`. Veřejná URL vede na přihlášení nebo not-found, `validateMove` postup odmítá a modul se neseeduje. Náhled `/dev/platform-types` existuje jen v `next dev` a nic neukládá.

Próza používá jediný token `cnb.jerrs` (blok `factNotice` i text). Konkrétní kompenzační limity (`gfo.nahrada`) lekce záměrně neuvádí; patří do 2.1.2 „Kdo tě chrání a před čím“ (#166). Modelové poplatky (0 Kč + 0,5 % přirážka, 30 Kč za pokyn, 0,9 % ročně, 2 % vstupní poplatek) jsou vymyšlené vstupy, ne tržní údaje.

Před publikací je nutné:

1. Odborně zrevidovat tvrzení o evropském pasu: dohled domovského vs. hostitelského státu u pobočky a u přeshraničních služeb, evidence zahraniční osoby v seznamech ČNB a ochrana majetku podle domovského státu.
2. Ověřit vymezení investičního zprostředkovatele (předává pokyny, nevede majetek klientů) proti účinnému ZPKT.
3. Zaznamenat revizi do `content-reviews.ts` a [reviews.md](reviews.md) s verzí `cnb.jerrs`.
4. Teprve poté přesunout z `draftLessons` do `authoredLessons`, nastavit modul i lekci `available`, přidat publikační kontrakt, aktualizovat browserové inventáře a ověřit průchod se skutečnou persistencí. Issue #165 do té doby zůstává otevřené.

Napojení na Portfolio Lab (fiktivní profil brokera, #136) lekce nepředstírá; zatím neexistuje.

## Ověření

- `platform-types.test.ts`: identita, umístění, zamčení konceptu a brána odborné revize; úplnost kroků a přechod chybná/správná odpověď; třídění 2 nabídky na typ a odmítnutí prohozené dvojice; přepočet srovnání poplatků ze vstupů (15 Kč < 30 Kč měsíčně, 1 500 Kč > 30 Kč jednorázově); token `cnb.jerrs`.
- `npm run test:platform-types-browser` na čerstvém `next dev` (port 3165, případně `PLATFORM_TYPES_TEST_URL`): 13 kroků, chybné třídění → zpětná vazba → oprava, klávesnice, přesun fokusu, žádný POST, neveřejná URL, 320/390/1440 px a 200% text na každém kroku. [Snímky všech kroků](lesson-reviews/platform-types.md).
- Žádná migrace ani změna účtování, odměnové politiky nebo persistence.
