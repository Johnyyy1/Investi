# Přestavět investi z kurzu metrik na přípravu k investování

**Hlavní závěr.** Současných 27 lekcí investi učí hlavně, jak měřit výnos a riziko. Neučí, jak reálně investovat. Kompletní kurikulum by mělo mít **sedm úrovní a jednu průběžnou behaviorální linii**:

- 0: finanční připravenost
- 1: jak investice fungují
- 2: investování v Česku v praxi (broker, poplatky, produkty, daně)
- 3: stavba a údržba portfolia
- 4: analýza akcií
- 5: oceňování a investiční teze
- 6: kvantitativní metody

Pořadí 0–3 odpovídá shodě veřejných kurikul: nejdřív rozpočet, dluh a rezerva, pak riziko, alokace, náklady, účty a daně, nákup a prodej a nakonec chování ([FINRA](https://www.finra.org/investors/investing/investing-basics); [Bogleheads](https://www.bogleheads.org/wiki/Bogleheads%C2%AE_investment_philosophy)). Stávající moduly Výnosy, Volatilita, Korelace a Diverzifikace se nemažou. Přesunou se zhruba do úrovně 3 (správa portfolia) a 6 (kvant) a zachovají si ID i pokrok. Největší díra je chování. Investoři v amerických fondech za 10 let do konce roku 2024 inkasovali **7,0 % ročně, zatímco fondy vydělaly 8,2 %**, a rozdíl způsobilo hlavně špatné načasování nákupů a prodejů ([Morningstar](https://www.morningstar.com/financial-advisors/volatility-bedevils-fund-investors)). Proto má nejvyšší prioritu úroveň 0, úroveň 2 a behaviorální jádro, k tomu závěrečný úkol „investiční plán (IPS)“ a úprava Portfolio Labu tak, aby odměňoval proces, ne obchodování. Analýzu akcií a kvant má smysl rozšiřovat až potom. Konkrétní lekce, prahy a herní mechaniky níže jsou můj návrh odvozený z citovaných zdrojů, ne převzatý standard. Zdrojované fakty jsou opatřené odkazem.

## Současných 27 lekcí učí měřit riziko, ne investovat

Z 27 lekcí je **20 (moduly 2–5) věnováno výpočtu a interpretaci výnosů, volatility, korelace a diverzifikace**. Jen modul Investiční základy (7 lekcí) se dotýká produktů a mechaniky trhu. Ve srovnání s osvědčenými kurikuly chybí celé bloky, bez kterých člověk nemůže sám začít:

- **Finanční připravenost.** Rozpočet, drahý dluh, rezerva a cíle jsou v každé veřejné cestě před investováním. Investor.gov končí úvod právě krokem „budget, pay down high-interest debt, emergency fund, protect against fraud“ ([Investor.gov](https://www.investor.gov/introduction-investing)). Bogleheads začínají principy „Live below your means“ a „Develop a workable plan“ ([Bogleheads](https://www.bogleheads.org/wiki/Bogleheads%C2%AE_investment_philosophy)).
- **Praxe účtu a exekuce.** Výběr brokera, ceník, měnová konverze, W-8BEN. FINRA má samostatné kapitoly „Buying and Selling“ a „Fees and Commissions“ ([FINRA](https://www.finra.org/investors/investing/investing-basics)).
- **Daně.** Zerodha Varsity má samostatný modul Markets and Taxation a 16kapitolový modul o řízení rizika a psychologii ([Zerodha Varsity](https://zerodha.com/varsity/modules/)). Damodaran řadí „Trading costs and taxes“ před jakoukoli strategii ([Damodaran](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/webcastinvphil.htm)).
- **Alokace aktiv, výběr ETF, rebalancing a měření vlastní výkonnosti** (časově vs peněžně vážený výnos).
- **Behaviorální finance a ochrana před podvody.** Evropský rámec EU/OECD výslovně jmenuje kompetence „scams and fraud“, „tax“ a „external influences on financial decisions“ ([Banco de España](https://clientebancario.bde.es/pcb/en/blog/marco-europeo-de-competencias-financieras-para-adultos.html)).
- **Analýza a oceňování akcií.** Jsou v zadání, ale v nabídce úplně chybí.

Druhý problém je pořadí. Kurikulum dnes postupuje jako akademický kurz, tedy od teorie a statistiky. Takhle začíná Shillerův kurz na Yale ([Coursera](https://www.coursera.org/learn/financial-markets-global)). Pro dospělého, který chce za měsíc otevřít účet, je to ale opačně. Kvantitativní obsah není špatný, jen je ho v poměru moc a přichází příliš brzy. Směrodatná odchylka a anualizace patří k pochopení metrik v Labu, logaritmické výnosy a korelace na reálných datech k prohloubení pro pokročilé. Třetí mezera je mezi nástroji a obsahem. Lab umí rozdělit výsledek na vliv ceny a kurzu a zohledňuje vklady, ale žádná lekce neučí, proč peněžně vážený výnos (MWR) odhaluje vlastní chyby v načasování. Backtesting Lab počítá Sharpe, ale nic neučí o přeučení na historických datech (overfittingu).

Česká data ukazují, že ani základ nelze předpokládat. V průzkumu OECD skončilo Česko **11. ze 14 zemí EU**, **skoro dvě třetiny domácností nevedou rozpočet a každý pátý dospělý aktivně nespoří** ([MF ČR](https://mf.gov.cz/cs/ministerstvo/media/tiskove-zpravy/2020/ministerstvo-financi-chce-financne-vzdel-37119)). Kurikulum, které začíná volatilitou, tuhle skupinu ztratí hned na začátku.

## Devět principů návrhu opřených o výzkum učení a chování

**1. Pořadí podle rozhodnutí, ne podle matematiky.** Investor.gov, FINRA, Bogleheads, Khan Academy i Motley Fool se shodují na sledu: základy financí → cíle a horizont → složené úročení a inflace → riziko → třídy aktiv a fondy → diverzifikace a alokace → náklady → účty a daně → exekuce → hodnocení výkonnosti → chování → podvody ([Investor.gov](https://www.investor.gov/introduction-investing); [FINRA](https://www.finra.org/investors/investing/investing-basics); [Motley Fool](https://www.fool.com/investing/how-to-invest/)). Výkazy, ukazatele a oceňování přicházejí až potom. CFA i Varsity zařazují analýzu výkazů před oceňování ([CFA Level I](https://www.cfainstitute.org/programs/cfa-program/candidate-resources/level-i-exam); [Varsity FA](https://zerodha.com/varsity/module/fundamental-analysis/)).

**2. Učit v okamžiku rozhodnutí.** Metaanalýza 201 studií zjistila, že finanční vzdělávání vysvětluje jen **0,1 % rozptylu finančního chování** a efekt **po 20 měsících mizí**. Autoři proto doporučují vzdělávání „just-in-time“, navázané na konkrétní rozhodnutí ([Fernandes et al., SSRN](https://papers.ssrn.com/abstract=2333898)). Pro investi to znamená zobrazit mikrolekci v Labu přímo ve chvíli, kdy uživatel jedná.

**3. Trénovat chování, ne jen znalosti.** Novější metaanalýza 76 randomizovaných studií se 160 000 účastníky našla efekty **nejméně třikrát větší**, než uváděli Fernandes et al., bez jasného rychlého vyprchání do dvou let. Zároveň ale potvrdila, že **dopad na znalosti je větší než na chování** ([DIW](https://www.diw.de/de/diw_01.c.785790.de/publikationen/diskussionspapiere/2020_1864/financial_education_affects_financial_knowledge_and_downstream_behaviors.html); [GFLEC](https://gflec.org/wp-content/uploads/2022/12/Meta_analysis_LusardiUrban-NEFE-final.pdf)). Strukturální nástroje fungují silněji než výklad. Program Save More Tomorrow zvedl míru úspor **z 3,5 % na 13,6 %** ([EconPapers](https://econpapers.repec.org/paper/febnatura/00337.htm)). Uživatel proto musí v investi skutečně vytvořit a nastavit plán, automatizaci a pravidla rebalancingu.

**4. Vybavování, rozestupy a míchání úloh jako páteř každé lekce.** Ze 10 studijních technik dostaly hodnocení „high utility“ jen **procvičovací testy a rozložené opakování** ([APS](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html)). V randomizované studii se 787 žáky dosáhlo smíšené procvičování **62 bodů proti 38 u blokového** v testu po 43 dnech ([IES WWC](https://ies.ed.gov/ncee/wwc/Study/88770)).

**5. Řešené příklady, které postupně ubývají, a možnost přeskočit.** Začátečníci se učí lépe z řešených příkladů se sebevysvětlováním. Pokročilým ale řešené příklady škodí, což se nazývá expertise reversal effect ([MIT Open Learning](https://openlearning.mit.edu/mit-faculty/research-based-learning-findings/worked-and-faded-examples)). Zkušený uživatel proto musí mít možnost přeskočit látku přes vstupní test.

**6. Ovládnutí látky (mastery) na grafu dovedností s vysokou laťkou.** Programy mastery learningu mají průměrný efekt **0,52 SD** a **vyšší kritérium zvládnutí dává větší efekt** ([Kulik et al. 1990](https://www.academia.edu/81783373/Effectiveness_of_Mastery_Learning_Programs_A_Meta_Analysis)). Khan Academy udělí stav „Mastered“ jen po správné odpovědi ve smíšeném testu a umí stav zase snížit ([Khan Academy](https://support.khanacademy.org/hc/en-us/articles/5548760867853)). ALEKS nabízí jako další krok jen to, k čemu má student splněné předpoklady, tzv. „outer fringe“ ([McGraw-Hill](https://www.mheducation.com/content/dam/mhe/research/prek-12/essa-tier-4/aleks-practical-perspective-knowledge-space-theory.pdf)).

**7. Simulace odměňuje proces, ne výnos.** Nejaktivnější obchodníci vydělali **11,4 % ročně proti 17,9 % trhu** ([Barber & Odean](https://faculty.haas.berkeley.edu/odean/Papers%20current%20versions/Individual_Investor_Performance_Final.pdf)). SEC řadí „paper trading competitions“ a konfety mezi praktiky, které podporují nadměrné obchodování ([SEC, Federal Register](https://www.govinfo.gov/content/pkg/FR-2021-09-01/pdf/2021-18901.pdf)). V experimentu s nejčastější zpětnou vazbou lidé riskovali nejméně a vydělali nejméně ([CAS](https://www.casact.org/abstract/effect-myopia-and-loss-aversion-risk-taking-experimental-test)).

**8. Česká realita jako samostatná linie s datovanými fakty.** Výklad daní roztroušený po lekcích se nedá udržovat. Vzorem je samostatný daňový modul Varsity ([Varsity](https://zerodha.com/varsity/modules/)).

**9. Poctivě o šancích dřív, než se začne vybírat akcie.** V roce 2025 zaostalo za S&P 500 **79 % aktivních fondů velkých amerických firem** ([S&P DJI](https://www.spglobal.com/spdji/en/spiva/article/spiva-us-year-end-2025/)). Mezi lety 1926 a 2016 vytvořilo veškeré bohatství nad výnos státních pokladničních poukázek jen **4,3 % amerických akcií** a **58 % akcií je za celou dobu nepřekonalo** ([ASU](https://news.wpcarey.asu.edu/20180917-do-stocks-outperform-treasury-bills)). Analýza akcií má být informovaná volba, ne výchozí cesta.

## Architektura: sedm úrovní, průběžná linie a čtyři milníky

Následující architektura je můj návrh. Sled úrovní 0–3 vychází z konsenzu výše. Úrovně 4–6 vycházejí ze sekvencí Varsity, Damodarana, Morningstaru a výzkumu kvantitativních pastí. Lekce mají délku 10–15 minut a končí kvízem, podobně jako mikrokurzy Morningstaru ([Upper Saddle River Library](https://uppersaddleriverlibrary.org/morningstar/)). Kódy lekcí (0.1.1 atd.) jsou jen zobrazovací. Interně platí stávající stabilní ID a nové lekce dostanou nová.

| Úroveň | Název (copy pro uživatele) | Moduly | Lekce (≈) | Povinnost |
|---|---|---|---|---|
| 0 | Než začneš investovat | 0.1 | 6 | Doporučená, přeskočitelná vstupním testem |
| 1 | Jak investice fungují | 1.1 | 9 | Povinná (odemyká Lab) |
| 2 | Investování v Česku v praxi | 2.1–2.5 | 30 | Povinná pro milník A |
| B | Investor v zrcadle (průběžně) | B.1 + karty v Labu | 10 | Jádro B1–B4 a B9 povinné pro milník A |
| 3 | Portfolio: stavba, údržba, měření | 3.1–3.5 | 31 | Povinná pro milník B |
| 4 | Analýza akcií | 4.0–4.3 | 20 | Volitelná dráha |
| 5 | Oceňování a investiční teze | 5.1–5.2 | 15 | Volitelná dráha (předpoklad 4) |
| 6 | Kvantitativní metody | 6.1–6.3 | 17 | Volitelná dráha (předpoklad 3) |
| V | Volitelné: páka a deriváty, krypto, technická analýza kriticky | V.1–V.3 | 9 | Volitelná |

Kurikulum má čtyři milníky:

- **Milník A „Připraven/a začít“** = úrovně 0–2 + jádro linie B + závěrečný úkol IPS.
- **Milník B „Samostatný pasivní investor“** = A + úroveň 3 + celá linie B.
- **Milník C „Samostatný analytik akcií“** = B + úrovně 4–5.
- **Milník D „Kvantitativní investor“** = B + úroveň 6.

Milník A je hlavní slib produktu. Kdo ho splní, ví, kde má rezervu, umí vybrat a ověřit brokera, chápe celkové náklady, zná hlavní pravidla českých daní a má sepsaný plán, který vyzkoušel v simulované krizi.

### Typy cvičení a hodnocení napříč kurikulem

Každá lekce má podle principů 4–5 stejnou kostru: řešený příklad → příklad, který uživatel dokončí sám → samostatná úloha → 2–4 otázky na vybavení + jedna výzva k sebevysvětlení („Proč je tady reálný výnos záporný?“). Mezi další typy cvičení patří:

- „Najdi chybu“ v řešení nebo ve výpisu,
- hledání v dokumentu (fiktivní ceník brokera, výpis dividend, KID, výroční zpráva),
- interaktivní posuvníky (náklady v čase, DCF),
- persony s rozhodnutím (např. 28 let, první výplata; 45 let, hypotéka),
- mise v Labu s měřitelným výstupem,
- psané výstupy hodnocené rubrikou: IPS, teze, kritika backtestu.

Každý modul končí **smíšeným checkpointem**, který prokládá úlohy z různých lekcí. Každá úroveň končí **závěrečným projektem** (capstone) se čtyřstupňovou rubrikou. Stavy zvládnutí navrhuji podle Khan Academy: Zkoušeno → Známé → Zvládnuté → Ovládnuté. „Ovládnuté“ vyžaduje správnou odpověď v odloženém smíšeném opakování a stav může klesnout ([Khan Academy](https://support.khanacademy.org/hc/en-us/articles/5548760867853)). Denní „Opakování“ s 5 smíšenými položkami se vybírá podle modelu zapomínání, který je u každé dovednosti zjednodušenou obdobou half-life regrese Duolinga ([Duolingo](https://blog.duolingo.com/how-we-learn-how-you-learn)). Pětiotázkovou vstupní diagnostiku navrhuji rozšířit na adaptivní vstupní test s nejvýše zhruba 30 otázkami a tlačítkem „Nevím“, podobně jako u ALEKS ([McGraw-Hill](https://www.mheducation.com/content/dam/mhe/research/prek-12/essa-tier-4/aleks-practical-perspective-knowledge-space-theory.pdf)). Uložený studijní plán se pak sestavuje z lekcí, ke kterým má uživatel splněné předpoklady.

### Úroveň 0 — Než začneš investovat

Předpoklady: žádné. Úroveň přímo navazuje na témata Standardu finanční gramotnosti z roku 2017, jako je rozpočet, srovnávání produktů, zajištění na stáří, úvěry a předlužení ([MF ČR](https://mf.gov.cz/cs/ministerstvo/media/aktuality/2017/standard-financni-gramotnosti-29163)).

| Lekce | Cíl: po lekci umíš… | Cvičení / napojení na nástroje |
|---|---|---|
| 0.1.1 Kolik ti zbývá: rozpočet a míra úspor | sestavit měsíční cash flow a spočítat míru úspor | šablona rozpočtu, výpočet částky, kterou můžeš investovat |
| 0.1.2 Dluh, nebo investice? | porovnat RPSN dluhu s realistickým výnosem a stanovit pořadí splácení | persona s kreditkou a spotřebitelským úvěrem |
| 0.1.3 Rezerva: kolik a kde | určit cílovou rezervu a vybrat místo pro ni; spočítat reálný výnos spořicího účtu | kalkulačka s aktuální inflací (**2,5 % v září 2026**, [ČSÚ](https://csu.gov.cz/rychle-informace/indexy-spotrebitelskych-cen-inflace-zari-2026)) a sazbou ČNB (**3,75 %**, [ČNB](https://www.cnb.cz/cs/menova-politika/br-zapisy-z-jednani/)) |
| 0.1.4 Cíle a horizont | rozdělit cíle na krátkodobé a dlouhodobé a přiřadit k nim vhodné nástroje | „mapa cílů“, která se uloží do profilu a později do IPS |
| 0.1.5 Penzijko, DIP a příspěvek zaměstnavatele v kostce | vysvětlit státní příspěvek **20 % až do 340 Kč při 1 700 Kč měsíčně** a společný odpočet 48 000 Kč | kalkulačka „kolik ti dá stát“ ([Money.cz](https://money.cz/novinky-a-tipy/dane/danove-podporovane-produkty-sporeni-na-stari-v-roce-2024/)) |
| 0.1.6 Podvody, slibované výnosy a finfluenceři | ověřit subjekt v seznamech ČNB (JERRS) a poznat znaky podvodu | úloha „ověř tři nabídky“ ([ČNB](https://www.cnb.cz/cs/dohled-financni-trh/vykon-dohledu/upozorneni-pro-verejnost/informace-pro-verejnost-k-opravneni-osob-poskytovat-sluzby-na-financnim-trhu/)) |

Hodnocení: **Finanční check-up**. Uživatel vyplní checklist (rezerva, drahý dluh, cíle, penzijko). Neprochází se ani nepropadá. Výsledek upraví studijní plán a uživateli bez rezervy nebo s drahým dluhem ukáže doporučení „nejdřív tohle“. Doporučení držet rezervu ve výši 3–6 měsíčních výdajů je běžná praxe, primární český zdroj se pro ni nepodařilo dohledat. Lekce ho proto má podávat jako pravidlo palce, ne jako normu.

### Úroveň 1 — Jak investice fungují

Předpoklady: žádné (0 je doporučená). Úroveň tvoří stávající modul Investiční základy (7 lekcí, ID zůstávají) a dvě nové lekce.

| Lekce | Cíl | Cvičení / Lab |
|---|---|---|
| 1.1.1–1.1.7 (stávající: proč investovat; akcie; ETF a indexy; dluhopisy a hotovost; trhy, bid/ask, exekuce; riziko, výnos, složené úročení; portfolio, váhy, diverzifikace) | beze změny cílů; doplnit otázky na vybavení a v lekci o exekuci odkaz na 2.2 | stávající |
| 1.1.8 Fondy: podílové fondy, ETF, aktivní vs pasivní | rozlišit typy fondů a vysvětlit, co znamená poplatek za správu | porovnání dvou fiktivních KID |
| 1.1.9 Kdo vyhrává: aktivní správa vs index | interpretovat SPIVA a vysvětlit, proč je index rozumným výchozím jádrem | interaktivní graf podílu zaostávajících fondů ([S&P DJI](https://www.spglobal.com/spdji/en/spiva/article/spiva-us-year-end-2025/)) |

Hodnocení: smíšený **Checkpoint 1**. Navrhuji do něj zařadit česky lokalizované otázky „Big Three“ od Lusardi a Mitchell (složené úročení, inflace, diverzifikace). Ty v USA správně zodpověděla jen **zhruba třetina** respondentů ve věku 50+ ([GFLEC](https://gflec.org///wp-content/uploads/2015/06/LusardiMitchell_FInLitEconOutcomes6-4-15-Forthcoming-in-Journal-of-Retirement.pdf)). Splnění checkpointu odemkne Portfolio Lab, stejně jako dnes splnění Foundations.

### Úroveň 2 — Investování v Česku v praxi

Předpoklady: úroveň 1. Tady je nejvíc nového obsahu a nejvíc reálné připravenosti. Daňové lekce mají v hlavičce povinné upozornění „vzdělávací obsah, ne daňové poradenství; stav k [datum]“ a všechny číselné údaje čerpají z registru faktů (viz údržba níže).

**Modul 2.1 Broker a účet**

| Lekce | Cíl | Cvičení / Lab |
|---|---|---|
| 2.1.1 Typy platforem | rozlišit execution-only brokera, robo-poradce či správu portfolia, banku a fondovou platformu | třídění 8 fiktivních nabídek (bez doporučování konkrétních značek) |
| 2.1.2 Kdo tě chrání a před čím | ověřit licenci v JERRS; vysvětlit Garanční fond (**90 % aktiv do 20 000 EUR** na klienta a obchodníka), segregaci majetku a rozdíl mezi selháním brokera a tržní ztrátou | úloha „co se stane, když…“ ([Fio – GFOCP](https://www.fio.cz/docs/cz/I_Garancni_fond.pdf)) |
| 2.1.3 Dotazníky přiměřenosti a vhodnosti | pochopit, proč se broker ptá na znalosti a zkušenosti (MiFID II) a co znamená varování | průchod modelovým dotazníkem ([ESMA](https://www.esma.europa.eu/node/98501)) |
| 2.1.4 Vlastníš akcii, nebo CFD? | rozpoznat CFD a páku; znát povinné varování, podle něhož **74–89 % retailových účtů prodělává** | „najdi CFD v nabídce“ ([ESMA](https://www.esma.europa.eu/node/84933)) |
| 2.1.5 Otevření účtu krok za krokem | projít identifikaci, vklad, měnu účtu a formulář W-8BEN | simulovaný onboarding |
| 2.1.6 Jak číst ceník | najít v ceníku poplatek za obchod, za konverzi měny, za úschovu a za neaktivitu | hledání v dokumentu; výsledky se přenesou do profilu poplatků v Labu |

**Modul 2.2 Poplatky a celkové náklady**

| Lekce | Cíl | Cvičení / Lab |
|---|---|---|
| 2.2.1 TER a tracking difference | vysvětlit, že TER je nejlepší prediktor odchylky od indexu, ale ne jediný | srovnání dvou ETF na stejný index ([etf.com](https://www.etf.com/sections/etf-basics/understanding-tracking-difference-and-tracking-error)) |
| 2.2.2 Spread a transakční poplatek | spočítat náklad jednoho nákupu včetně bid/ask | navazuje na 1.1.5; nákup v Labu se zobrazeným rozpadem nákladů |
| 2.2.3 Měnová konverze | spočítat náklad konverze CZK→EUR/USD a pochopit, že měna fondu ≠ měnové riziko | výpočet na fiktivním ceníku ([justETF](https://www.justetf.com/en/academy/die-richtige-etf-auswahl.html)) |
| 2.2.4 Náklady za 30 let | modelovat dopad celkových nákladů na složené úročení | Backtesting Lab: stejná strategie s různými náklady |
| 2.2.5 Checkpoint: srovnej dva brokery | sestavit celkové roční náklady pro vlastní plán | rubrika; výstup se uloží |

**Modul 2.3 Produkty v EU a výběr ETF**

| Lekce | Cíl | Cvičení / Lab |
|---|---|---|
| 2.3.1 UCITS, domicil a proč nekoupíš americké ETF | vysvětlit požadavek KID (PRIIPs) a preferenci irského a lucemburského domicilu | ([justETF](https://www.justetf.com/en/news/etf/us-domiciled-etfs.html)) |
| 2.3.2 Akumulační vs distribuční | zhodnotit český daňový argument pro akumulační fondy (výnos se po 3 letech mění v osvobozený zisk) | kalkulačka dividend vs zisk ([RuleCalc](https://rulecalc.com/cs/dan/etf-zdaneni)) |
| 2.3.3 Replikace a index | rozlišit fyzickou, výběrovou (sampling) a syntetickou replikaci; porovnat MSCI World, FTSE All-World a ACWI IMI | Detail instrumentu: holdings a expozice přes TickerInside |
| 2.3.4 Checklist výběru ETF | aplikovat kritéria: náklady, TD, velikost, stáří, replikace, domicil, distribuce | vyplnění checklistu pro 3 ETF |
| 2.3.5 Pasti: pákové, inverzní a tematické produkty | vysvětlit, proč se nehodí k držení na dlouho | srovnání v nástroji pro porovnání instrumentů |

**Modul 2.4 Daně investora v ČR** (vzdělávací, datováno, napojeno na registr faktů)

| Lekce | Cíl | Cvičení / Lab |
|---|---|---|
| 2.4.1 Kdy musíš podat přiznání | znát hranici 50 000 Kč a výjimku pro zaměstnance s ostatními příjmy do 20 000 Kč (osvobozené a srážkové se nepočítají) | rozhodovací strom ([Finanční správa](https://financnisprava.gov.cz/cs/dane/dane/dan-z-prijmu/fyzicke-osoby/obecne-informace)) |
| 2.4.2 Časový test: 3 roky pro každou tranši | určit, které nákupy jsou při prodeji osvobozené | Lab: „daňová mapa tranší“ s datem osvobození ([Pohoda](https://portal.pohoda.cz/zakon-a-pravo/finance-a-dane/zdaneni-prijmu-z-prodeje-cennych-papiru/)) |
| 2.4.3 Limit 100 000 Kč hrubých příjmů | vysvětlit, že se testuje úhrn příjmů z prodeje, ne zisk | Lab: počítadlo příjmů z prodejů v daném roce |
| 2.4.4 Když se daní: § 10, výdaje a ztráty | spočítat základ (příjem − pořizovací cena − poplatky); vědět, že ztráty se v § 10 započítávají, ale dílčí základ nesmí být záporný | „najdi chybu“ ve výpočtu |
| 2.4.5 Dividendy z ČR a ze zahraničí | rozlišit českou 15% srážkovou daň od zahraničních dividend v přiznání; zápočet do výše české daně; W-8BEN (15 % místo 30 %); ř. 38 a Příloha č. 3; samostatný základ daně | modelový výpis s fiktivními čísly ([Finex](https://finex.cz/zdaneni-dividend-jak-postupovat-pri-vyplneni-danoveho-priznani/)) |
| 2.4.6 Přepočet cizí měny | rozlišit denní kurz ČNB a jednotný kurz a vědět, že metody nelze v roce míchat | kalkulace s kurzy za rok 2025 (**EUR 24,66; USD 21,84**, [GFŘ-D-75](https://financnisprava.gov.cz/assets/cs/prilohy/d-sprava-dani-a-poplatku/Pokyn_GFR_D-75_podpis.pdf)) — **pro rok 2026 ověřit** |
| 2.4.7 Oznamovací povinnost nad 5 mil. Kč | vědět, že osvobozené příjmy nad 5 mil. Kč se oznamují (§ 38v); znát lhůty a sankce 0,1/10/15 % | případová studie ([Forvis Mazars](https://www.forvismazars.com/cz/cs/prehledy/forvis-mazars-v-mediich/archiv-2026/osvobozene-prijmy-nejsou-bez-povinnosti)) |
| 2.4.8 DIP a penzijko podrobně | vysvětlit odpočet 48 000 Kč (úspora **7 200 / 11 040 Kč**), podmínku 120 měsíců a 60 let, ztrátu výhod při porušení a příspěvek zaměstnavatele do 50 000 Kč | srovnání DIP vs běžný účet ([DAUČ](https://www.dauc.cz/clanky/14639/uplatneni-dlouhodobeho-investicniho-produktu)) |
| 2.4.9 Evidence a doklady | vést záznamy o tranších a uchovávat výpisy (důkazní břemeno nese poplatník) | export historie z Labu jako vzor |

**Modul 2.5 První plán a první nákup** (závěrečný úkol milníku A)

| Lekce | Cíl | Cvičení / Lab |
|---|---|---|
| 2.5.1 Investiční plán (IPS) | sepsat cíle, horizont, alokaci, pravidla rebalancingu a postup „co udělám při −30 %“ | strukturovaná šablona, která se uloží do profilu |
| 2.5.2 Automatizace | nastavit pravidelnou investici (trvalý příkaz, spořicí plán) jako závazek předem | Lab: měsíční příspěvek v simulovaném čase |
| 2.5.3 První nákup nanečisto | provést celý nákup s realistickými poplatky a konverzí | Lab mise |
| **Capstone A** | IPS + nákup + krizový nácvik (B10) | rubrika: soulad portfolia s IPS, náklady, diverzifikace, chování v krizi |

### Linie B — Investor v zrcadle (průběžná behaviorální linie)

Popisuji ji podrobně v samostatné kapitole níže. Lekce B1–B4 a B9 jsou předpokladem pro Capstone A, ostatní pro milník B.

### Úroveň 3 — Portfolio: stavba, údržba, měření

Předpoklady: 1 a 2.2. Sem se přesouvá většina stávajících kvantitativních lekcí, doplněná o praktické části.

| Modul | Lekce (S = stávající, N = nová) | Klíčové cíle a napojení na Lab |
|---|---|---|
| 3.1 Výnos a výkonnost | S: co je výnos; prosté výnosy; složené/kumulativní; porovnávání výnosů. N: reálný vs nominální výnos po nákladech; **časově vs peněžně vážený výnos**; volba benchmarku. S: checkpoint | MWR vs TWR přímo nad P&L v Labu, které zohledňuje vklady; rozdíl mezi nimi je „tvoje mezera chování“ |
| 3.2 Riziko v číslech | S: pochopení volatility; směrodatná odchylka; anualizace; max drawdown a zotavení; aplikace | metriky v Labu a Backtesting Labu propojené se sdíleným glosářem |
| 3.3 Korelace a diverzifikace | S: korelační koeficient; korelace v krizích; koncentrace; sektorová a zemní expozice; look-through a překryvy ETF; korelace a riziko portfolia; interaktivní scénář. N: domácí zaujatost (home bias) | nástroj pro porovnání instrumentů (korelace), holdings přes TickerInside; srovnání podílu CZ a EU s globální tržní vahou |
| 3.4 Alokace aktiv | N: riziková kapacita vs tolerance; poměr akcií a dluhopisů; globální tržní váhy jako neutrální výchozí bod; dluhopisy hlouběji (durace, sazby); jednoduchost 1–3 ETF; kurzové riziko pro investora v CZK | rozklad výsledku na cenu a kurz v Labu; argument „1/N je těžké porazit“ ([DeMiguel et al.](https://ideas.repec.org/a/oup/rfinst/v22y2009i5p1915-1953.html)) |
| 3.5 Údržba portfolia | N: pravidelně vs jednorázově (DCA vs lump sum); rebalancing podle kalendáře, podle pásem a novými příspěvky; daňově šetrný rebalancing (časový test, limit 100 000 Kč); jak často se dívat; roční přezkum IPS | cílová alokace a rebalancing v Labu; Backtesting Lab: s rebalancingem a bez něj |

Capstone B: **„Moje portfolio na 10 let“**. Uživatel postaví portfolio podle IPS, otestuje ho v Backtesting Labu s náklady a sepíše zdůvodnění. Ukáže, jak by daňově šetrně rebalancoval, a projde přehráním let 2008, 2020 a 2022.

### Úroveň 4 — Analýza akcií

Předpoklady: milník B. Sled vychází z Varsity (výroční zpráva → výkazy → ukazatele → due diligence) a z rámce Morningstaru.

| Modul | Lekce | Klíčové cíle / cvičení |
|---|---|---|
| 4.0 Brána: šance | Poctivě o šancích: SPIVA, Bessembinder a model jádro–satelit | generátor „10 náhodných akcií vs index“ ukazuje šikmost výnosů ([ASU](https://news.wpcarey.asu.edu/20180917-do-stocks-outperform-treasury-bills)) |
| 4.1 Byznys a odvětví | obchodní model; Porterových pět sil; 5 zdrojů moatu (síťový efekt, náklady na přechod, nákladová výhoda, nehmotná aktiva, efektivní velikost trhu); management a alokace kapitálu; unit economics se skepsí | klasifikace 10 firem podle zdroje moatu s doložením ROIC ([Morningstar](https://www.morningstar.in/posts/9152/behind-morningstars-economic-moat-rating.aspx)) |
| 4.2 Účetní výkazy | anatomie výroční zprávy / 10-K; výsledovka; rozvaha; cash flow; propojení tří výkazů; dividendy, zpětné odkupy a ředění z SBC; kvalita účetnictví a varovné signály (M-score); IFRS vs US GAAP na příkladu leasingu | hledání v 10-K; model tří výkazů pro modelovou firmu; výpočet M-score ([Wikipedia](https://en.wikipedia.org/wiki/Beneish_M-score)); EBITDA po IFRS 16 ([AcadiFi](https://acadifi.com/community/ifrs-16-vs-asc-842-lease-accounting-differences-cfa-level-2)) |
| 4.3 Ukazatele | marže; ROE a DuPontův rozklad; ROIC vs WACC; FCF a FCF yield; zadluženost a krytí úroků; srovnání s odvětvím | dashboard 3 firem vs mediány odvětví podle Damodarana ([Damodaran data](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datacurrent.html)); fundamenty z FMP v Detailu instrumentu |

Ke každému ukazateli patří karta „kdy lže“. Například ROE nafukuje zadlužení a zpětné odkupy, EBITDA ignoruje investice (capex) a leasing a P/B nedává smysl u firem s převahou nehmotných aktiv. Výběr ukazatelů je moje syntéza, ne autoritativní žebříček.

### Úroveň 5 — Oceňování a investiční teze

Předpoklady: 4.2 a 4.3, pro diskontní sazbu 3.1.

| Modul | Lekce | Klíčové cíle / cvičení |
|---|---|---|
| 5.1 Oceňování | cena vs hodnota; relativní ocenění (P/E, EV/EBITDA, P/B, PEG); past levné akcie (value trap) a past drahé akcie; DCF: FCFF diskontované WACC vs FCFE diskontované nákladem vlastního kapitálu; zjednodušená diskontní sazba (CAPM, ERP od Damodarana); terminální hodnota a zánik nadvýnosů; citlivost a scénáře; reverzní DCF; bezpečnostní polštář podle nejistoty | DCF s posuvníky a tabulkou WACC × g; reverzní DCF „co cena předpokládá“; vzor třífázového DCF Morningstaru ([Morningstar Methodology](https://s205.q4cdn.com/437373358/files/doc_downloads/2025/07/Morningstar-Equity-Research-Methodology-2023-06-14.pdf)) |
| 5.2 Teze a disciplína | příběh a čísla; teze na jednu stranu; pre-mortem a kritéria ukončení; velikost pozice a limit satelitu; kdy prodat; deník a srovnání s indexem | pracovní list „věta příběhu → vstup modelu“ a test „3P“ (impossible, implausible, improbable), převzatý od Damodarana ([Damodaran](https://pages.stern.nyu.edu/~adamodar/pdfiles/country/narrative&numbersrealshortMcKinsey2024.pdf)) |

Capstone C: jedna firma se táhne celou dráhou. Na ní uživatel udělá mapu byznysu → analýzu 10-K → propojení výkazů → ukazatele → DCF a reverzní DCF → tezi s pre-mortemem → vzájemné hodnocení → revizi po 6 měsících v deníku. Limity jako „max. 5 % na akcii“ nebo „satelit 10–20 %“ jsou ilustrativní návrh, ne pravidla podložená zdrojem.

### Úroveň 6 — Kvantitativní metody

Předpoklady: úroveň 3.

| Modul | Lekce | Klíčové cíle / cvičení |
|---|---|---|
| 6.1 Matematika výnosů | S: logaritmické výnosy. N: aritmetický vs geometrický průměr a volatility drag; očekávaný vs realizovaný výnos; tlusté chvosty | sandbox: +50 % a −50 % = −25 % |
| 6.2 Riziko a teorie | N: beta a CAPM; Sharpe, Sortino, Calmar a chyba odhadu; efektivní hranice a její křehkost; faktory (Fama-French, momentum). S: korelace na reálných datech | regrese ETF na faktory z [French Data Library](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html); nestabilita hranice vs 1/N |
| 6.3 Backtest bez sebeklamu | N: look-ahead bias a survivorship bias; přeučení a počet pokusů; náklady a daně; out-of-sample a walk-forward; Monte Carlo a sekvenční riziko; čerpání v důchodu | hra „přeuč to schválně“ na náhodných datech; počítadlo pokusů v Backtesting Labu |

Klíčová fakta pro úroveň 6:

- Nový faktor by měl splnit **t > 3,0**, protože většina publikovaných nálezů je pravděpodobně falešná ([NBER](https://nber.org/papers/w20592)).
- Výnosy anomálií klesají **o 26 % mimo vzorek a o 58 % po publikaci** ([CFA Institute](https://rpc.cfainstitute.org/research/cfa-digest/2016/06/does-academic-research-destroy-stock-return-predictability-digest-summary)).
- Deflated Sharpe Ratio koriguje počet zkoušených variant ([SSRN](https://papers.ssrn.com/abstract=2460551)).
- Bezpečná výchozí míra čerpání podle Morningstaru klesla na **3,7 %** pro 30 let ([Morningstar](https://www.morningstar.com/retirement/whats-safe-retirement-spending-rate-2025)).

### Volitelné moduly

**V.1 Páka a deriváty** pojímá CFD a opce jako koncepty s důrazem na rizika ESMA. **V.2 Krypto** má odlišná daňová pravidla: test 100 000 Kč a 3 roky, strop 40 mil. Kč zůstal jen u krypta a výjimka se nevztahuje na e-money tokeny ([DAUČ](https://www.dauc.cz/clanky/16039/prehled-zmen-ve-zdaneni-fo-dle-zakona-c-360-2025-sb); [KDP/GFŘ](https://financnisprava.gov.cz/assets/cs/prilohy/d-placeni-dani/Krypto-29_4_2026.pdf)). **V.3 Technická analýza kriticky** ji učí jako test efektivity trhu, tedy tak, jak ji zařazuje Damodaran ([Damodaran](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/webcastinvphil.htm)).

## Kam patří stávajících 27 lekcí

Žádná lekce se nemaže a žádné ID se nemění. Mění se jen umístění v grafu, předpoklady a štítky dovedností. Technicky navrhuji registr lekcí, kde má každé stabilní ID nová pole `uroven`, `modul`, `poradi`, `predpoklady[]`, `dovednosti[]` a `povinnost`. Splněné lekce se při migraci započítají do nových modulů a milníků. Pokud nový modul obsahuje i nové lekce, uživatel uvidí stav „rozpracováno“, ne „hotovo“, a nová lekce se mu nabídne jako další krok.

| Stávající modul (lekce) | Nové umístění | Poznámka |
|---|---|---|
| 1 Investiční základy (všech 7) | Úroveň 1, modul 1.1, lekce 1–7 | doplnit 1.1.8–1.1.9; lekce o exekuci odkazuje na 2.2 |
| 2 Výnosy: co je výnos, prosté, složené/kumulativní, porovnávání | 3.1 Výnos a výkonnost | doplnit reálný výnos, TWR/MWR, benchmark |
| 2 Výnosy: logaritmické výnosy | 6.1 Matematika výnosů | pro milník B volitelné |
| 2 Výnosy: checkpoint | checkpoint 3.1 | rozšířit o nové lekce, dělat prokládaně |
| 3 Volatilita (všech 5) | 3.2 Riziko v číslech | anualizace a směrodatná odchylka zároveň jako předpoklad pro 6.2 |
| 4 Korelace: koeficient; korelace v krizích | 3.3 Korelace a diverzifikace | |
| 4 Korelace: korelace vs kauzalita | Linie B (B8 „Příběhy, korelace a kauzalita“) | posun z matematiky ke kritickému myšlení |
| 4 Korelace: reálná data | 6.2 | v 3.3 volitelné |
| 5 Diverzifikace (všech 5) | 3.3 Korelace a diverzifikace | doplnit home bias |

Practice Capital za už splněné lekce se nevrací. Nová pravidla (viz níže) platí jen do budoucna. Odemčení Labu přes Foundations zůstává, aby se nezměnil zážitek stávajících uživatelů.

## Behaviorální linie: zažít chybu, vidět svá data, nastavit pojistku

Chování je největší a nejlépe změřená mezera. Morningstar ukazuje rozdíl 1,2 p. b. ročně, tedy zhruba 15 % výnosu. **U fondů s nejvolatilnějšími toky je mezera 1,8 p. b., u nejstabilnějších 0,8 p. b.** Alokační fondy s automatickým rebalancingem zachytily asi **97 % výnosu** ([Morningstar](https://www.morningstar.com/financial-advisors/volatility-bedevils-fund-investors)). Výzkum zároveň nenašel kvalitní randomizovanou studii, která by ukazovala, že samotný výklad o zkresleních snižuje zkreslené obchodování. Silnější doklady mají strukturální nástroje: defaulty, automatizace a závazky předem. Proto má každá lekce linie B tři kroky: **zážitek v Labu → rozbor s vlastními daty vedle výzkumných → pojistka, kterou si uživatel sám nastaví**.

| Lekce | Zážitek v Labu | Rozbor | Pojistka |
|---|---|---|---|
| B1 Mezera chování | přehrání krizí 2008, 2020 a 2022 s tlačítky koupit/prodat | tvůj MWR vs TWR; Morningstar 1,2 p. b. | IPS + automatický příspěvek |
| B2 Přehnaná sebedůvěra a obchodování | volné obchodování 5 simulovaných let s reálnými poplatky | tvůj obrat vs 11,4 % vs 17,9 % ([Barber & Odean](https://faculty.haas.berkeley.edu/odean/Papers%20current%20versions/Individual_Investor_Performance_Final.pdf)) | rozpočet obratu, checklist před obchodem |
| B3 Dispoziční efekt | portfolio ziskových a ztrátových pozic, ze kterého musíš uvolnit hotovost | tvůj PGR vs PLR; výzkum ukazuje, že investoři prodávají vítěze zhruba dvakrát častěji než poražené | prodávat podle plánu nebo rebalancingu, ne podle nákupní ceny; možnost skrýt nákupní cenu |
| B4 Averze ke ztrátě a krátkozrakost | stejné portfolio při denním a ročním pohledu, volba poměru akcií a dluhopisů | jak frekvence pohledu změnila tvou alokaci ([CAS](https://www.casact.org/abstract/effect-myopia-and-loss-aversion-risk-taking-experimental-test)) | frekvence kontroly (čtvrtletně/ročně), notifikace ve výchozím stavu vypnuté |
| B5 Stádo, FOMO a pozornost | „trendující“ seznam v simulaci | nákupy na Robinhoodu následovalo **−4,7 % abnormálního výnosu za 20 dní** ([WashU](https://profiles.wustl.edu/en/publications/attention-induced-trading-and-returns-evidence-from-robinhood-use/)) | výzva „Proč to kupuju?“, odložený watchlist |
| B6 Kotvení a recency | odhad příštího výnosu po ukázání různých minulých období | jak se odhady posunuly | dlouhodobé základní míry, rozpětí scénářů |
| B7 Mentální účetnictví | rozdělení na „hrací“ a „jádrové“ peníze | pohled na riziko celého portfolia | jeden IPS pro všechny účty |
| B8 Příběhy, korelace a kauzalita | (stávající lekce) titulky typu „X způsobilo Y“ | proč korelace nedokazuje příčinu | otázka „jaký je mechanismus a co by to vyvrátilo?“ |
| B9 Nástroje proti chybám | IPS, checklist, pre-mortem ([PHF](https://archive.phf.org/resourcestools/Documents/Pre_Mortem_Analysis.pdf)), automatizace | — | uložené výstupy v profilu |
| B10 Krizový nácvik | −30 % v simulovaném čase s vlastním portfoliem | dodržel/a jsi IPS? | revize IPS |

Mimo lekce běží **karty v okamžiku rozhodnutí**:

- prodej vítěze při držení poražených → karta k dispozičnímu efektu,
- pátý obchod v týdnu → karta k obratu a nákladům,
- backtest vybraný po mnoha pokusech → karta k přeučení,
- prodej tranše měsíc před uplynutím časového testu → daňová karta.

Studie simulační hry zjistila, že **aktivní účast snížila sebedůvěru a dispoziční efekt, ale zvýšila familiaritu a status quo bias** ([University of Brighton](https://research.brighton.ac.uk/en/publications/impact-of-gamification-on-mitigating-behavioral-biases-of-investo/)). Lab proto musí aktivně stavět proti domácí zaujatosti, ne být neutrální.

### Practice Capital a gamifikace: odměňovat učení a proces, nikdy obchod

Dnešní model (5 000 Kč za Foundations, 2 000 Kč a 60 XP za každou další lekci) odměňuje učení, ne obchodování, a to je dobrý základ. Rizika jsou jinde. Uživatel může jednorázový kapitál „protočit“, P&L je v Labu na prvním místě a mechanika neříká nic o pravidelném investování. Regulátoři jmenují jako problematické konfety a oslavy obchodů, žebříčky, push notifikace na pohyby cen a na „čas od posledního obchodu“ a loterijní odměny ([SEC](https://www.govinfo.gov/content/pkg/FR-2021-09-01/pdf/2021-18901.pdf)). Massachusetts kvůli podobným prvkům vymohlo na Robinhoodu **7,5 mil. USD** ([WealthManagement.com](https://www.wealthmanagement.com/regulation-compliance/robinhood-pays-7-5m-to-settle-massachusetts-gamification-charge)). ESMA chce gamifikaci připustit jen tehdy, když podporuje dlouhodobé, diverzifikované investování ([Investment Executive](https://www.investmentexecutive.com/from-the-regulators/esma-targets-finfluencers-gamification/)).

Navrhuji tyto úpravy (jde o můj návrh):

1. **Kapitál vázat na zvládnutí, ne na proklikání.** Část odměny se vyplatí až po úspěšném odloženém opakování, protože vyšší laťka zvládnutí dává větší efekt (Kulik).
2. **Nové Practice Capital vyplácet jako měsíční „příjem“ v simulovaném čase**, ne jako jednorázovou částku. Uživatel tak trénuje pravidelné investování a pracuje s funkcí příspěvků, kterou Lab už má.
3. **Bonusy za výstupy procesu.** Sepsaný IPS, rebalancing podle plánu, vydržení krizového nácviku a nízký obrat. Nikdy za počet obchodů nebo za výnos. XP nikdy za obchod.
4. **„Skóre procesu“ jako hlavní metrika Labu**: diverzifikace (HHI), náklady, obrat, soulad s IPS, cash drag. Výnos se zobrazuje vedle MWR a TWR, ne jako hlavní číslo.
5. **Žádné žebříčky podle výnosu, žádné konfety za obchody, notifikace o cenách vypnuté.**
6. **Realistické tření**: poplatky podle fiktivních profilů brokerů, měnový spread a daňová mapa tranší. Obchodování tak „stojí“ stejně jako v reálu.
7. **Learning streaky** vázat na denní opakování, ne na aktivitu v Labu.

Navenek se to dá prezentovat jako hodnota produktu: „Nebudeme tě nutit obchodovat.“ Existuje i reálné riziko, které výzkum nevyřešil. Nenašel se důkaz, že úspěch v paper tradingu zvyšuje sebedůvěru při investování skutečných peněz, ale ani důkaz opaku. Proto je dobré tento přenos sledovat.

## Výsledky měřit chováním v Labu, ne minutami a streaky

Protože dopad na znalosti převyšuje dopad na chování a efekty mohou časem slábnout, musí investi měřit obojí, a to i se zpožděním. Navrhuji tyto vrstvy:

| Vrstva | Nástroj | Kdy |
|---|---|---|
| Znalosti (vstup/výstup) | Big Three v češtině s CZK + 5–8 investičních položek (dopad TER, reálný výnos, korelace, sekvenční riziko); slouží zároveň jako vstupní test | onboarding, konec milníků |
| Udržení | neskórované kontrolní položky v opakování, podobně jako „extra problems“ v ALEKS | 2, 8 a 26 týdnů po zvládnutí |
| Hlavní metrika učení | počet dovedností ve stavu Zvládnuté a výš (Khan Academy ji validovala proti externímu testu MAP, [Khan Academy blog](https://blog.khanacademy.org/?p=13201)) | průběžně |
| Dovednosti | výstupy hodnocené rubrikou: IPS, srovnání brokerů, kritika backtestu, teze | capstony |
| Chování v Labu | obrat, počet pozic a HHI, cash drag, prodej po simulovaném −20 %, soulad s IPS, PGR/PLR, rozdíl MWR−TWR | před linií B a po ní, krizový nácvik |
| Reálné kroky (dobrovolně, opt-in) | krátký dotazník: rezerva, trvalý příkaz, penzijko ≥ 1 700 Kč, W-8BEN, evidence tranší | 3 a 12 měsíců po milníku A |
| Finanční pohoda (volitelně) | CFPB Financial Well-Being Scale, zkrácená verze ([CFPB](https://www.consumerfinance.gov/data-research/research-reports/financial-well-being-scale/)); validovaný český překlad se nenašel | ročně |

Pro kauzální závěry navrhuji randomizovat karty v okamžiku rozhodnutí a varianty lekcí (A/B) a srovnávat chování v Labu. Je to levné a odpovídá to doporučení testovat dopad na chování, ne na kvízy. Severkou produktu by měl být **podíl uživatelů s milníkem A, kteří v krizovém nácviku dodrželi svůj IPS**, doplněný o počet dovedností ve stavu Zvládnuté a výš. Čas v aplikaci by severkou být neměl. Upozornění: kontrolní body 2/8/26 týdnů, složení vstupního testu a severka jsou můj návrh. Výzkum žádnou studii spaced retrieval přímo ve finančních vzdělávacích aplikacích nenašel, důkazy jsou převzaté z matematiky a jazyků.

## Daňová a regulatorní fakta udržovat jako data s datem ověření

Česká pravidla se mění každý rok. Strop 40 mil. Kč platil pro cenné papíry jen v roce 2025 a zákon č. 360/2025 Sb. ho od 1. 1. 2026 pro cenné papíry zrušil ([DAUČ](https://www.dauc.cz/clanky/16039/prehled-zmen-ve-zdaneni-fo-dle-zakona-c-360-2025-sb)). Pro krypto se pravidla změnila od 15. 2. 2025. Text lekcí proto nesmí čísla obsahovat napevno. Navrhuji **registr faktů**: každá položka má hodnotu, platnost od–do, zdroj (URL), datum posledního ověření, vlastníka a termín příští kontroly. Lekce čísla vkládá přes tokeny (např. `{{limit_hodnotovy_test}}`) a pod každou daňovou lekcí se automaticky zobrazí „stav k [datum]“ a upozornění, že jde o vzdělávací obsah. Faktum po termínu kontroly se v redakčním rozhraní označí a po delší prodlevě se na stránce objeví upozornění.

Roční kalendář údržby (návrh):

- **leden**: pokyn GFŘ k jednotnému kurzu (za rok 2025 vyšel 14. 1. 2026 ve Finančním zpravodaji), sazby a hranice daně (pro 2026 je hranice 23% sazby **1 762 812 Kč**, [ARROWS](https://arws.cz/novinky-v-arrows/jak-se-od-roku-2026-opet-meni-daneni-prijmu-z-prevodu-podilu-v-s-r-o-a-prodeje-akcii)), legislativa účinná k 1. 1.;
- **únor–březen**: lhůty přiznání (za rok 2025: 1. 4. papírově, 4. 5. elektronicky, 1. 7. přes poradce, [Finanční správa](https://financnisprava.gov.cz/cs/financni-sprava/media-a-verejnost/tiskove-zpravy-gfr/tiskove-zpravy-2026/dan-z-prijmu-za-rok-2025-tyden-do-konce-lhuty)) a sezónní připomínka lekcí 2.4;
- **měsíčně**: inflace ČSÚ a sazba ČNB (zasedání 5. 11. a 17. 12. 2026);
- **pololetně**: DIP, penzijko, SPIVA, data Damodarana a French library;
- **ad hoc**: EU Retail Investment Strategy (politická dohoda 18. 12. 2025, termíny až po vyhlášení v Úředním věstníku, [CMS](https://cms.law/en/int/legal-updates/eu-retail-investment-strategy-political-agreement-key-points-and-implications-for-eu-and-non-eu-firms)).

Daňové lekce by před publikací měl zkontrolovat daňový poradce. Ostatní obsah stačí jednou ročně revidovat redakčně.

### Položky, které podle podkladů ještě vyžadují ověření

| Položka | Proč je nejistá | Co udělat |
|---|---|---|
| Písmena § 4 odst. 1 ZDP (t/u vs w/x; zj/zk) | sekundární zdroje se v písmenech rozcházejí; nejautoritativnější je varianta t)/u)/zj)/zk) podle KDP/GFŘ a DAUČ | ověřit na e-Sbírce; v lekcích písmena raději neuvádět |
| Darované cenné papíry a § 4 odst. 3 | RuleCalc uvádí pro převzetí data nabytí u daru § 4 odst. 3, ale podle DAUČ je od 2026 v § 4 odst. 3 strop pro krypto, takže odkazy si odporují | ověřit v zákoně před lekcí o dědictví a darech |
| Jednotný kurz pro zdaňovací období 2026 | pokyn GFŘ-D-75 odkazuje na § 38 „ve znění účinném do 31. 12. 2025“, takže § 38 se zřejmě změnil a nové znění se nepodařilo zjistit | ověřit před lekcí 2.4.6 pro rok 2026 |
| 15% srážka z úroků českých bank; úroky u zahraničních brokerů | nepotvrzeno z načteného zdroje | ověřit |
| 35% srážka pro státy bez smlouvy | nepotvrzeno | ověřit |
| W-8BEN a sazba 15 % | jen sekundární zdroje, tabulka IRS se nenačetla | ověřit u IRS |
| Zápočet jen 10 % u některých smluv (AT, NL, FR) | sekundární zdroj | ověřit podle jednotlivých smluv |
| 15% srážka z amerických dividend uvnitř irského fondu | obecná znalost, neověřeno | ověřit, nebo formulovat obecně |
| Garanční fond (§§ ZPKT, 90 % / 20 000 EUR) | údaje pocházejí z dokumentu banky, gfo.cz se nenačetl | ověřit na gfo.cz a v ZPKT |
| Kompenzační schémata zahraničních brokerů | neověřeno | popisovat obecně |
| PRIIPs KID a UCITS (primární texty) | zdrojem je justETF | ověřit v Úředním věstníku EU |
| DIP a penzijko – změny pro 2026 | žádné nalezeny, ale absence ve výsledcích hledání není důkaz | ověřit před publikací |
| DAC8 v ČR | neprozkoumáno | ověřit pro modul V.2 |
| Doporučení k velikosti rezervy | primární zdroj ČNB nebo MF nenalezen | podávat jako pravidlo palce |
| Rozdíly IFRS vs US GAAP mimo leasing | primární zdroj se nenačetl | ověřit podle srovnání PwC/KPMG |
| Zastaralý údaj „1 000 Kč“ u penzijka | jde o starý práh pro odpočet, od 7/2024 platí 1 700 Kč ([DAUČ](https://www.dauc.cz/aktuality/1001/vyssi-statni-podpora-pro-individualni-sporeni-na-stari)) | zkontrolovat stávající texty |

## Pořadí implementace: nejdřív to, co chrání peníze

Pořadí řídí jedna otázka: co nejvíc sníží reálné chyby člověka, který zítra otevře účet? Podle podkladů jsou nejdražší chyby špatné načasování, nadměrné obchodování a náklady. U českého investora k nim přibývají daňové omyly. Teprve potom je drahá neznalost oceňování.

**Fáze 1: milník A „Připraven/a začít“.**

- Registr lekcí a přemapování stávajících 27 lekcí (levné a odblokuje všechno ostatní).
- Registr faktů.
- Úroveň 0.
- Moduly 2.2 (náklady), 2.4 (daně) a 2.1 (broker).
- Šablona IPS (2.5.1).
- Ochranné prvky v Labu: skóre procesu nahoře, žádné oslavy obchodů, realistické poplatky a konverze, daňová mapa tranší a počítadlo limitu 100 000 Kč.

**Fáze 2: chování a údržba portfolia.**

- Jádro linie B (B1–B4, B9, B10) s krizovým nácvikem v Labu.
- Karty v okamžiku rozhodnutí.
- MWR vs TWR v Labu (3.1).
- Moduly 2.3 (výběr ETF), 3.4 (alokace) a 3.5 (rebalancing).
- Denní opakování a stavy zvládnutí.
- Výchozí měření: vstupní test a metriky chování.
- Úprava Practice Capital (měsíční příjem, bonusy za proces).

**Fáze 3: dokončení milníku B.** Zbytek linie B, capstone B, adaptivní vstupní test, kontrolní položky na udržení a první A/B test karet.

**Fáze 4: analýza akcií (úroveň 4).** Brána 4.0, výkazy a ukazatele napojené na fundamenty z FMP v Detailu instrumentu, karty „kdy lže“ a projekty A1–A4.

**Fáze 5: oceňování a teze (úroveň 5).** DCF s posuvníky, reverzní DCF a deník tezí s revizí po 6 měsících.

**Fáze 6: kvant a volitelné moduly.** Faktory, hra na přeučení a počítadlo pokusů v Backtesting Labu, Monte Carlo a čerpání, moduly V.1–V.3.

Fáze 4–6 jsou pro investi lákavé, protože navazují na současnou silnou stránku. Ale proti tomu stojí čísla SPIVA a Bessembinder: pro většinu uživatelů mají analýza akcií a kvant menší vliv na výsledek než chování a náklady. Proto je dávám až za milník B.

## Závěr

Investi nepotřebuje víc matematiky. Potřebuje převrátit poměr: kvantitativní obsah má sloužit rozhodnutím, ne být sám cílem. Hlavní odlišení od běžných kurzů nejsou samotné lekce. Je to propojení obsahu se simulací. Portfolio Lab může poskytnout kombinaci, kterou výzkum podporuje a kterou má málokdo: chybu si uživatel zažije bezpečně, vidí ji ve svých datech a sám si nastaví pojistku. Učení přichází ve chvíli rozhodnutí a hodnotí se proces, ne výnos. Pokud Lab převezme české tření (poplatky, konverzi, časový test po tranších), stane se z hřiště trenažérem skutečného investování.

Druhý přínos je měřitelnost. Investi má na rozdíl od školních programů přímý přístup k chování uživatelů v simulaci. Může tak na vlastních datech ověřit otázku, kterou literatura nechává otevřenou: zda vzdělávání mění chování trvale, nebo efekt slábne. Pokud se metrikou úspěchu stane „dodržel/a plán v simulované krizi“ místo „dokončil/a lekci“, bude investi vědět, jestli lidi skutečně připravuje.
