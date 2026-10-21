# UI terminology

Each concept has one name in the interface. The UI is Czech; an English term appears only as a supplement in brackets, e.g. „Největší propad (max. drawdown)“. Code, tests and internal docs may keep their English or internal names (`PracticeCapital`, `StudovnaPage`, `maxDrawdown`).

`src/lib/terminology.test.ts` flags the retired variants in `src`.

| Concept | UI name | Not in the UI | Notes |
|---|---|---|---|
| Learning section (`/learn`) | **Učení** | Studovna | Navigation, page title, back links („Zpět na Učení“) and aria-labels. „Studovna“ remains the internal name of the design direction and its components. Lowercase „učení“ is the activity („Pokračovat v učení“). |
| Spendable learning reward | **cvičný kapitál** | Practice Capital, virtuální kapitál, kapitál z lekcí, cvičné peníze | Capitalised only at the start of a label or sentence („Cvičný kapitál“). Contrast it with real money in words: „Cvičný kapitál, nic skutečného.“ Practice Capital is the English term for code and English docs. |
| Available money in the portfolio | **hotovost** | Practice Capital | Cash is not the same as cvičný kapitál: cash is what is left to spend after trades. A failed buy says „nemáš dost hotovosti“. |
| Fall from the previous peak | **propad** | drawdown (alone) | One fall: „propad od vrcholu“. |
| Maximum drawdown | **Největší propad** | Maximální drawdown | Add „(max. drawdown)“ once in the explanation, not in the label. Backtesting and the instrument detail use the same label. |
| Return over the whole backtest period | **Celkový výnos** | výnos (alone) | Not annualized. The detail says so, next to „CAGR“, which is. The instrument detail still says „Jednoduchý výnos“ for the same quantity (#33). |
| Personal portfolio gain/loss | **Zisk / ztráta od otevření portfolia** | od nákupu | Amount in Kč, including realized results and recorded costs, excluding contributed capital. Percentages are separately named TWR/MWR, never gain divided by earned capital. |
| Sharpe ratio | **Sharpeho poměr** | Sharpe | Add „(Sharpe ratio)“ in the explanation, not in the label. Always name the risk-free rate it used. Unavailable is „Nedostupné“, never 0. |
| Trading costs in a backtest | **Náklady obchodů** | transakční náklady | „Poplatek z objemu obchodu“ is the rate, „Fixní poplatek za obchod“ the flat fee. The result switch says „S náklady / Bez nákladů“. |
| Traded value of all trades | **Obrat** | turnover (alone) | Add „(turnover)“ in the explanation, not in the label. |
| Learning progress points | **XP** | body, body za lekce | XP stays visible and gates the Portfolio Lab unlock (decided in issue #35). Show it as a secondary learning measure, never as spendable value: Practice Capital leads. |
| Product name | **investi** | investi! in text | `investi!` is the typeset wordmark only. Running text, page titles and aria-labels say „investi“; a wordmark link names its target: „investi · úvodní stránka“, „investi · Učení“. |

Metric labels in Backtesting and the instrument detail should eventually come from one registry (#33); until then, change both places together.

## Curriculum 2.0: autorské názvosloví

Při tvorbě lekcí postupuj podle [standardu lekce](education/lesson-standard.md). Český pojem nejdřív vysvětli; anglický ekvivalent nebo rozepsání zkratky uveď při prvním výskytu v závorce. Pak používej stejný český název. Tabulka sjednocuje jazyk nového obsahu; netvrdí, že plánované funkce už existují. Právní podmínky, sazby a lhůty patří do datovaného registru faktů, nikoli do tohoto slovníku.

| Pojem | Název v UI / lekci | Pravidlo použití |
| --- | --- | --- |
| Total expense ratio | **celková nákladovost fondu (TER)** | Při prvním výskytu doplň „total expense ratio“. Není totéž co všechny náklady investora: odliš náklady fondu, obchodu a konverze. Nezaměňuj automaticky s jiným ukazatelem nákladů v KID. |
| Tracking difference | **rozdíl ve výkonnosti vůči indexu** | Poprvé „rozdíl ve výkonnosti vůči indexu (tracking difference)“. Uveď období, srovnatelnou výnosovou řadu a znaménkovou konvenci; nejde o kolísání tohoto rozdílu. Viz definice v [ESMA/2014/937, oddíl II](https://www.esma.europa.eu/sites/default/files/library/2015/11/esma-2014-0011-01-00_en_0.pdf). |
| Tracking error | **kolísání rozdílu výnosů vůči indexu** | Poprvé doplň „tracking error“. Odliš od tracking difference; u výpočtu uveď frekvenci a anualizaci. Viz definice v [ESMA/2014/937, oddíl II](https://www.esma.europa.eu/sites/default/files/library/2015/11/esma-2014-0011-01-00_en_0.pdf). |
| Benchmark | **srovnávací index** | U neindexového srovnání „srovnávací portfolio (benchmark)“. Uveď měnu, období a zahrnutí distribucí a nákladů. |
| Bid–ask spread | **rozpětí nákupní a prodejní ceny (spread)** | Při prvním vysvětlení odliš bid a ask; spread není poplatek brokera. „Měnový spread“ používej pro konverzi a vysvětli jeho základ. |
| FX conversion | **měnová konverze** | Nezaměňuj kurz obchodu s kurzem pro daňový přepočet; náklad konverze uveď samostatně. |
| Time-based tax exemption test | **časový test** | Vysvětli jako podmínku doby držení pro možné osvobození. Délku, výjimky a datum platnosti čerpej z ověřeného faktu; cenné papíry a krypto neztotožňuj. |
| Sale-proceeds tax exemption test | **hodnotový test** | Příslušný limit a rozsah příjmů jsou datované právní údaje. Neoznačuj jej jako limit zisku. |
| Sale proceeds / gain | **příjem z prodeje / zisk z prodeje** | Jde o různé veličiny. U každého výpočtu pojmenuj, se kterou pracuješ; daňové posouzení vyžaduje konkrétní pravidlo a období. |
| Tax lot | **daňová tranše** | Při prvním výskytu vysvětli jako konkrétní nabytí s datem, množstvím a pořizovacími údaji. Není totéž co celá pozice. |
| Investment policy statement | **investiční plán (IPS)** | Poprvé doplň „investment policy statement“. Praktický výstup s cílem, horizontem, alokací, příspěvky a pravidly kontroly; není doporučením investi. |
| Key information document | **dokument s klíčovými informacemi (KID)** | Poprvé doplň „key information document“. Právní požadavky ověř v registru faktů; nevydávej modelový dokument za skutečný KID produktu. |
| UCITS / PRIIPs | **UCITS / PRIIPs** | Zkratky zachovej a při prvním výskytu srozumitelně vysvětli jejich účel. Jejich podmínky, dostupnost produktů a právní důsledky potřebují ověřené datované zdroje. |
| Asset allocation / rebalancing | **alokace aktiv / rebalancování** | Nejdřív vysvětli rozdělení portfolia a návrat k cílovému rozdělení podle plánu. Vyšší počet obchodů není cílem. |
| Money-weighted return | **peněžně vážený výnos (MWR)** | Poprvé doplň „money-weighted return“. Zachycuje i velikost a načasování vnějších peněžních toků; uveď jejich konvence a neslibuj výpočet bez potřebných dat. Viz [CFA Institute, úvod do GIPS, s. 23](https://rpc.cfainstitute.org/sites/default/files/docs/codes-and-standards/introduction-to-the-gips-standards-for-asset-owners_requirements_online.pdf). |
| Time-weighted return | **časově vážený výnos (TWR)** | Poprvé doplň „time-weighted return“. Odděluje vliv vnějších peněžních toků; rozdíl proti MWR sám neprokazuje chybu v chování. Viz [CFA Institute, úvod do GIPS, s. 23](https://rpc.cfainstitute.org/sites/default/files/docs/codes-and-standards/introduction-to-the-gips-standards-for-asset-owners_requirements_online.pdf). |
| Financial readiness / emergency reserve | **finanční připravenost / finanční rezerva** | Check-up je podklad pro rozhodnutí, nikoli pass/fail ani potvrzení připravenosti na skutečné investování. Velikost rezervy není univerzální konstanta. |
| Investment horizon / risk capacity / risk tolerance | **investiční horizont / schopnost nést riziko / ochota nést riziko** | Odliš dobu do použití peněz, finanční možnost unést ztrátu a psychickou ochotu snášet kolísání. |
| Home bias / familiarity bias | **domácí zaujatost / zaujatost známým** | Poprvé doplň anglický termín a konkrétní příklad; jedna pozice ani rozhodnutí nedokazují zkreslení. |
| Pre-mortem / safeguard | **rozbor možného selhání / osobní pojistka** | Poprvé „rozbor možného selhání (pre-mortem)“. Pojistka je konkrétní pravidlo nebo kontrolní seznam zvolený člověkem, ne slib ochrany před ztrátou. |
| Overfitting / out-of-sample | **přeučení / ověření mimo původní vzorek** | Anglické termíny poprvé v závorce. Příznivý backtest neprokazuje budoucí výnos ani kvalitu strategie. |
| Learning mastery | **Zkoušeno → Známé → Zvládnuté → Ovládnuté** | Cílové stavy zvládnutí, oddělené od celoživotního dokončení. Jejich prahy a plánování potřebují vlastní implementační specifikaci. |
