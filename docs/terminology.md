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
| Sharpe ratio | **Sharpeho poměr** | Sharpe | Add „(Sharpe ratio)“ in the explanation, not in the label. Always name the risk-free rate it used. Unavailable is „Nedostupné“, never 0. |
| Learning progress points | **XP** | body, body za lekce | XP stays visible and gates the Portfolio Lab unlock until issue #35 decides otherwise. |
| Product name | **investi** | investi! in text | `investi!` is the typeset wordmark only. Running text, page titles and aria-labels say „investi“; a wordmark link names its target: „investi · úvodní stránka“, „investi · Učení“. |

Metric labels in Backtesting and the instrument detail should eventually come from one registry (#33); until then, change both places together.
