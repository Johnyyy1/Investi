# Přestavět Investník z kurzu metrik na přípravu k investování

Přijato jako nový produktový směr: **21. 10. 2026**.

## Jak tento dokument používat

Tento dokument vymezuje použití dodaného podkladu pro přestavbu Investníku na přípravu k investování. Prioritou je finanční připravenost, česká praxe, náklady, daně, investiční plán (IPS) a chování. Rozšiřování analýzy akcií, oceňování a kvantitativních metod je zmrazené do doložené poptávky a rozhodnutí foundera. Pokyny pro práci v repozitáři tento směr promítají do [AGENTS.md](../AGENTS.md).

Jde o cílový stav a pořadí rozvoje. Popsané funkce tím nejsou označené za implementované. Aktuální chování určují kód, testy a [smlouvy učení a persistence](product-reset.md). Přesuny kurikula zachovají stabilní ID, pokrok, historické odměny a už zaznamenané odemčení Labu. Změny odměn a měsíčního vyplácení budou platit do budoucna prostřednictvím verzované politiky; samotné přijetí směru nemění současnou politiku v4.

Celý [původní podklad](education/curriculum-research.md) je už uložen v dodaném znění včetně odkazů a seznamu neověřených položek; tento dokument na něj odkazuje. Jeho daňová, regulatorní, tržní ani výzkumná tvrzení nebyla v rámci této dokumentační úpravy nezávisle ověřena. Před publikací lekcí nebo implementací výpočtů je nutné ověřit příslušné primární zdroje a zaznamenat platnost a datum kontroly. Přesné počty otázek, prahy zvládnutí, termíny opakování a herní mechaniky jsou návrhy k implementaci a vyhodnocení.

Pro implementaci platí tato upřesnění: úroveň 0 je doporučená a lze ji prokázat vstupním testem; finanční check-up není zkouška. Milník A vyžaduje také praktický závěrečný úkol a krizový nácvik B10, i když související obsah vzniká ve více fázích. „Skóre procesu“ znamená především vysvětlitelná kritéria; souhrnné číslo vyžaduje doložený model. Podklad zachycuje dřívější stav produktu; aktuální publikovaný inventář je třeba ověřit v registru. MWR−TWR může ukázat vliv načasování peněžních toků, samo o sobě ale nedokazuje chybu v chování.

## Strategie 2026–27: komu a jakou hodnotu přinášíme

Cílový uživatel je **začínající samostatný investor**: chce začít nebo právě začal a potřebuje předejít zásadním chybám. Jde o jeho situaci, nikoli úroveň znalostí. Cesta proto vede od finanční připravenosti přes rozhodnutí a bezpečný nácvik k vlastnímu plánu. Pokročilé dráhy vznikají jen podle doložené poptávky.

Tato strategie má přednost před starým pořadím „C2 Fáze 1–6“ v [původním podkladu](education/curriculum-research.md) a starších issues. Sedm úrovní a milníky A–D zůstávají mapou kurikula, nikoli závazkem všechno postupně postavit. **Issues se štítkem `later` jsou zmrazené: nezačínat je ani znovu neotevírat bez výslovného rozhodnutí foundera.** To se týká zejména L4–L6, volitelných témat a CFA/PFP. Splněné technické závislosti ani volná kapacita tuto bránu nenahrazují. Existující pokročilé lekce, stabilní ID, pokrok, účtenky a přístupy zůstávají zachované.

### Fáze S0–S3 a brány

Termíny jsou plánovací cíle. Do další fáze se postupuje až s doloženým výsledkem brány; samotné datum ani uzavření implementačních issues nestačí. Strategické fáze S0–S3 jsou odlišné od vzdělávacích milníků A–D.

| Fáze | Cílový termín | Brána pro postup dál |
| --- | --- | --- |
| S0 — Základy a měření | 30. 11. 2026 | 3–5 rozhovorů s brokery/bankami: za co a podle jaké metriky by platili |
| S1 — Milestone A | 28. 2. 2027 | 1 000 registrací, ≥ 30 % dokončí Milestone A |
| S2 — Partnerský pilot | 30. 6. 2027 | 1 placený pilot s měřenou aktivací účtů |
| S3 — Škálování a Milestone B | 31. 10. 2027 | opakovaná smlouva a data o konverzi do účtu |

S0 zahrnuje minimální produktovou analytiku ([#355](https://github.com/Johnyyy1/Investnik/issues/355)), tuto dokumentaci a rozhodnutí o licenci a IP ([#357](https://github.com/Johnyyy1/Investnik/issues/357)). S1 směřuje k úplnému milníku A včetně IPS, praktického úkolu a krizového nácviku B10. S2 ověřuje partnerský pilot. S3 rozvíjí ověřený model a milník B; příprava na Slovensko má samostatný rozsah ([#361](https://github.com/Johnyyy1/Investnik/issues/361)). Žádná z těchto fází automaticky neodemyká `later`.

### Výstup každého modulu a hranice produktu

Každý modul končí **artefaktem**, který uživatel využije při rozhodování: například finančním check-upem, mapou cílů, srovnáním nákladů, checklistem brokera nebo ETF, IPS či jeho revizí po krizovém nácviku. Kvíz a mixed checkpoint ověřují porozumění, ale artefakt nenahrazují. Používat existující verzované úložiště výstupů; tento požadavek sám nemění historické dokončení ani odměny.

Lab hodnotí **proces**: vysvětlitelná kritéria nákladů, diverzifikace, obratu a souladu s vlastním IPS podle dostupných dat. Výnos slouží jako kontext, není známkou správného rozhodnutí ani cílem odměn. Vyčkat nebo dodržet plán může být správný výsledek.

Investník poskytuje vzdělávání a podporu vlastního rozhodovacího procesu. **Negeneruje personalizovaná doporučení konkrétních instrumentů** ani pokyny k jejich nákupu či prodeji. Spotřebitelská verze zůstává neutrální: **žádné affiliate žebříčky brokerů ani ETF**. Uživatel se učí porovnávat kritéria a zdroje; obchodní vztah neurčuje pořadí ani doporučení.

### B2B: stejný vzdělávací engine pro partnery

Jádro pro uživatele je zdarma; cílový obchodní model jsou licence pro brokery a banky, kterým vzdělávání pomůže s aktivací klientů. Partnerská verze využívá stejný engine, obsahové a procesní hranice. První pilot zahrnuje identifikaci partnera, co-branding (logo/barvu), výběr cesty a deep-link zpět do produktu partnera ([#358](https://github.com/Johnyyy1/Investnik/issues/358)); plný white-label, SSO/SAML, RBAC, SDK a mobilní embed čekají na konkrétní poptávku.

Dashboard odděluje výsledky učení (milník A, zvládnutí, IPS, dodržení plánu v krizi) od obchodních výsledků partnera (deep-link prokliky a partnerem doložené otevření účtu, první vklad, první či pravidelná investice). Zobrazuje agregovaná a anonymizovaná data, umožňuje CSV export a nepředává osobní údaje bez souhlasu ([#359](https://github.com/Johnyyy1/Investnik/issues/359)). Nabídka pilotu má samostatnou stránku „Pro instituce“ ([#360](https://github.com/Johnyyy1/Investnik/issues/360)). Partnerské CTA nemění hranici personalizovaných doporučení. Konverze do účtu je metrika partnera, nikoli důkaz vzdělávacího účinku nebo důvod odměňovat obchodování.

Zdroje strategických rozhodnutí: [zadání #356](https://github.com/Johnyyy1/Investnik/issues/356), [řídicí roadmapa #362](https://github.com/Johnyyy1/Investnik/issues/362) a související issues výše. Roadmapa odkazuje na [strategický podklad](https://claude.ai/artifact/8je4bbURnYCqZueQpdRbRU); jeho obsah při této úpravě nebyl dostupný, proto jsou fáze a brány převzaté z #362.

## Soulad s aktuální implementací

Na `main` už existuje registr kurikula 2.0, politika odměn v4, verzované výstupy uživatelů a poplatky s měnovými náklady v Portfolio Labu. Navazující úkoly je rozšiřují podle skutečně chybějícího rozsahu. Politika v4 odvozuje odměnu od úrovně kurikula, uchovává historické účtenky a ponechává odemčení Labu na původních sedmi Foundations a 420 XP. Měsíční příjem v simulovaném čase patří do odděleného tréninkového portfolia; osobní portfolio si zachovává kapitál odvozený z účtenek.

Při tvorbě lekcí platí [standard Lesson 2.0](education/lesson-standard.md). Podrobnosti již implementovaných kontraktů popisují [verzované výstupy uživatelů](learner-artifacts.md), [Portfolio Lab](portfolio-lab.md) a [smlouvy učení a persistence](product-reset.md).
