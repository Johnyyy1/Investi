# 0.1.5 — Penzijko a DIP: kolik ti přidá stát

Implementace [#152](https://github.com/Johnyyy1/Investnik/issues/152). **Redakční koncept, ne publikovaná lekce.** `dps.odpocet` a `dip.podminky` jsou v registru blokované (`publicationBlockedBy`) a daňová lekce potřebuje záznam odborné revize (#133). Ověření agentem ji nenahrazuje.

- Stabilní identita: `before-investing-retirement-products`, modul `module-before-investing`, slug `pension-and-dip`, budoucí URL `/learn/before-investing/pension-and-dip`.
- Umístění 0.1.5, doporučená L0, předpoklad `before-investing-goals` (0.1.4), dovednost `retirement-products`. Ostatní lekce, kurzory, odměny ani odemčení Labu se nemění; politika v4 dává L0 jen XP.
- Manifest je `planned`; veřejná URL zobrazí not-found a server odmítne postup. Redakční náhled `/dev/pension-and-dip` (jen `next dev`) používá sdílený `LessonDraftPreview` a nic neukládá.
- Dvanáct kroků: Evin problém → státní příspěvek → strop → odpočet → výpočet odpočtu a úspory → DIP a společný limit → příspěvek zaměstnavatele → vázanost → kalkulačka a Evino rozhodnutí → vybavení (odpočet vs. úspora) → sebevysvětlení → shrnutí s `factNotice`. Nejvýše jedna hodnocená otázka na krok, poslední bez otázky.

## Fakta a model

Próza používá tokeny `{{dps.statni_prispevek}}`, `{{dps.odpocet}}`, `{{dip.podminky}}` a `{{zam.prispevek}}`. Výpočty (příspěvek, odpočet, úspora) a kalkulačka `state-support-calculator` vycházejí z doménové specifikace [pension-model.ts](../../src/features/lessons/before-investing/pension-model.ts). Unit test ji porovnává se všemi verzemi uvedených faktů v registru: nová verze s jinou hodnotou test shodí, dokud redakce model a příklady nezreviduje. Každá číselná odpověď a hodnota řešeného příkladu se v testu přepočítá ze vstupů.

Mezery před publikací:

1. Sazba 20 % a hranice odpočtu nad 1 700 Kč měsíčně nemají samostatný číselný fakt; dnes jsou jen v modelu a v próze. Doplnit je do registru a kalkulačku napojit na serverově vyřešené hodnoty (vzor `emergency-fund-calculator`).
2. Sazba daně 15 % je označená jako modelový předpoklad; `dan.sazby_dpfo` je neověřený.
3. Osvobození příspěvku zaměstnavatele od pojistného (`zam.pojistne`) je neověřené; lekce ho výslovně netvrdí. Ani „dodanění až 10 let zpětně“ z issue lekce neuvádí.
4. Návrh „Spoření od kolébky“ a starý práh odpočtu lekce nezmiňuje; test hlídá, že v obsahu není „1 000 Kč“.
5. Zapsat odbornou revizi podle #133, přesunout lekci do `authoredLessons`, nastavit `available`, přidat kontrakt do `published-lessons-v1.json` a odebrat ji z `draftLessons`.

## Ověření

`npm test -- src/features/lessons/before-investing/pension-and-dip.test.ts`; `npm run test:pension-and-dip-browser` na čerstvém `next dev` (výchozí port 3152, `PENSION_DIP_TEST_URL`) prochází všech 12 kroků, chybu a opravu, kalkulačku, klávesnici a fokus, žádný POST, 320/390/1440 px a kalkulačku při 200% textu a ověřuje not-found veřejné URL.
