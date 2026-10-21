# Datované fakty a tokeny v lekcích

Registr [registry.ts](../../src/features/facts/registry.ts) obsahuje všech 27 klíčů z [#132](https://github.com/Johnyyy1/Investnik/issues/132), včetně dvou verzí `dan.strop_40m` pro roky 2025 a 2026. Historické údaje se nepřepisují dnešním pravidlem. Nejde o daňovou kalkulačku ani o odborné schválení lekcí.

Každá verze nese hodnotu s jednotkou, jurisdikci, právní základ nebo povahu výzkumu, interval použitelnosti, období pozorování a případně zdaňovací období, zdroje, vlastníka, datum kontroly, stav a datum úspěšného ověření a příští revizi. `validTo` je včetně uvedeného dne. Interval vymezuje pokrytí registru, nemusí začínat původní účinností zákona. Číselná procenta jsou procentní body (`3.75` s jednotkou `%` → `3,75 %`); tyto hodnoty nejsou zdrojem účetnictví Labu.

## Co je skutečně ověřeno

Počáteční kontrola proběhla **21. 10. 2026**. Primární zdroje jsou uvedené přímo u jednotlivých verzí. Stav `primary` znamená, že uvedený zdroj podporuje vymezenou hodnotu, nikoli kompletní právní interpretaci, platnost pro všechny případy nebo revizi daňovým poradcem. `secondary` je podporovaný stav pro doložené sekundární ověření.

Původní podklad ani stav z issue není samostatným důkazem. Nedostupné texty, neověřené podrobnosti a kandidátní hodnoty proto zůstávají `unverified` s `verifiedAt: null`; `checkedAt` zaznamenává pokus o ověření. To platí například pro W-8BEN, úroky, zahraniční dividendy, přesnou aplikaci časového testu, MiFID, PRIIPs/UCITS a Morningstar (zdroj vracel 403). Nezaměňovat neúspěšnou kontrolu za úspěšnou revizi.

`publicationBlockedBy` blokuje publikaci i u primárně ověřené hodnoty, pokud zůstává nevyřešený podstatný výklad. Příkladem je `dan.limit_100k`: výše je potvrzená Finanční správou, započítání časově osvobozených prodejů do úhrnu čeká na [#134](https://github.com/Johnyyy1/Investnik/issues/134). U penzijních produktů čeká ověření následných novel; u ESMA je ověřen historický rámec, nikoli všechna současná opatření ČNB. Odstranění blokace musí mít doloženou revizi. Odborné schvalování lekcí a evidence poradce patří do [#133](https://github.com/Johnyyy1/Investnik/issues/133).

Výzkumné záznamy obsahují vzorek, sledované období a omezení. SPIVA se vztahuje na konkrétní kategorii amerických fondů v roce 2025, Morningstar na americká data za deset let do konce roku 2024. Nedokládají kauzální účinek investi ani chybu konkrétního uživatele.

## Autorství a publikace

Použij token v textovém poli bloku, například:

```ts
{ id: "threshold", type: "paragraph", content: "Oznamovací hranice: {{dan.oznameni_5m}}. Podmínky a výjimky vysvětluje následující příklad." }
```

`prepareLessonFacts` na serverové stránce lekce vyhodnotí celý prezentační obsah, včetně otázek, možností, řešených příkladů a skryté zpětné vazby. Do klienta odejde vyřešený text a malý objekt oznámení; celý registr se do lekce neimportuje. React text bezpečně escapuje. Tokeny se nepoužívají v ID, URL, správných ID odpovědí, identifikátorech figur ani v TeXu. Běžné složené závorky v TeXu zůstávají beze změny. Číselnou správnou odpověď nepřepočítává renderer: časově proměnlivé právní zadání potřebuje samostatnou revidovanou doménovou specifikaci a odpovídající testy. Neobcházej tuto hranici kopií právní sazby do `answer`.

Bez `factContext.asOf` se vybírá pravidlo platné v den zobrazení podle kalendáře Europe/Prague. Pro historickou lekci nastav datum **pravidla**, například `factContext: { kind: "tax", asOf: "2025-12-31" }` pro jednotný kurz za zdaňovací období 2025. Datum podání v roce 2026 není zdaňovacím obdobím 2026. Verze bez odpovídající platnosti selže; nepoužije se nejbližší ani dnešní pravidlo. Překrývající se verze jsou chyba registru. U makrodat a výzkumu musí próza uvést také období pozorování.

Každá lekce používající ověřené fakty dostane automaticky oznámení „Vzdělávací obsah, ne daňové ani investiční poradenství · stav k [datum]“. Datum je nejstarší `verifiedAt` všech použitých verzí, nikdy datum commitu. Lekce označená `factContext.kind: "tax"` musí mít datované odkazy; běžná lekce bez faktů oznámení nemá. Datum platnosti scénáře a dnešní kontrola čerstvosti jsou oddělené.

Neznámý nebo chybně zapsaný token selže i v konceptu. Publikovaná lekce navíc nesmí odkazovat na neověřenou nebo blokovanou verzi. Kontrola všech `available` položek katalogu běží v unit testech CI, přes `npm run check:facts`, v `prebuild` a na začátku `vercel-build` před migracemi. Stejná kontrola při zobrazení brání tichému dosazení pravidla, jehož platnost od buildu skončila. Přímé `next build` obchází npm lifecycle; pro lokální build používej `npm run build`.

## Revize a údržba

`/dev/facts` existuje pouze za `NODE_ENV=development`; v produkci vrací 404. Přehled zobrazuje všechny verze, zdroje, blokace, chybějící ověření, vlastníky a termíny. Datum kontroly lze měnit pro redakční náhled. Pevný vzorový text zde není registrovaná lekce a nic neukládá ani neodměňuje.

Den po `nextReviewAt` se objeví redakční příznak. Od **60. kalendářního dne prodlení včetně** se v lekci zobrazí „Údaj může být zastaralý“ s názvy dotčených faktů. To je explicitní redakční politika této implementace, nikoli výzkumem potvrzený práh. Čerstvost se vyhodnocuje při zobrazení i pro historický scénář; původní interval použitelnosti přitom zůstává zachovaný.

Leden: daňová pravidla a kurzy; sezóna přiznání: lhůty; měsíčně: makrodata; pololetně: produkty a výzkum; ad hoc: legislativní změny. Role vlastníků jsou v registru, při odborné revizi je nutno přiřadit skutečného recenzenta podle #133. Tato změna nevytváří naplánované úlohy ani upozornění. Při změně hodnoty uzavři interval předchozí verze a přidej novou se zdrojem a skutečným datem ověření. Nedoplňuj neznámou hodnotu nulou.

Ověření: `npm run check:facts`, `npm test -- src/features/facts src/components/lesson/lesson-fact-notice.test.tsx src/app/dev/facts/page.test.tsx`. Pro čerstvý vývojový server na portu 3132 spusť `npm run test:facts-browser`; `FACTS_TEST_URL` mění adresu, `FACTS_EXPECT_PRODUCTION=1` ověřuje pouze produkční 404. Pro screenshoty lze nastavit `FACTS_SCREENSHOT_DIR`.

Identita a struktura lekcí, hodnocení, uložený kurzor, dokončení, odměny, odemčení a účetnictví Labu zůstávají beze změny. Nejsou potřeba DB migrace.
