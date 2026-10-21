import { benchmarkName, type BacktestHistoryView, type BacktestInstrument, type HistorySource } from "@/features/backtesting/catalog";
import type { BacktestCosts, RebalanceRule } from "@/features/backtesting/spec";
import { formatDate } from "@/lib/formatters";
import type { BacktestChartSource } from "./backtest-chart";
import { formatBacktestMoney, formatCostRate } from "./backtest-model";

export type BacktestSourceKind = "sample" | "history";

/** Everything the page says about where the numbers come from, for one data source. */
export type BacktestSourceCopy = {
  /** Header and comparison label, e.g. „Historická data · Financial Modeling Prep · 2008–2025“. */
  label: string;
  chart: BacktestChartSource;
  notes: readonly { term: string; detail: string }[];
  method: readonly string[];
  periodHint: string;
  amountHint: string;
  runHint: string;
  /** Closing sentence of the reflection: what the result does and does not describe. */
  scope: string;
};

export const sampleSourceCopy: BacktestSourceCopy = {
  label: "Ukázková data · syntetické výnosy",
  chart: {
    tag: "Ukázková data",
    note: "Vymyšlená měsíční řada. Nic z grafu nepředpovídá budoucí výnosy.",
    details: "Kč je zobrazovací jednotka · bez FX, dalších vkladů, poplatků a daní · přímé spojnice měsíčních pozorování",
  },
  notes: [
    { term: "Zdroj", detail: "Syntetický měsíční vzorek vytvořený pro Investník. Žádná tržní pozorování." },
    { term: "Dostupné období", detail: "Leden 2015 – prosinec 2025 · 132 měsíčních výnosů" },
    { term: "Výnosy a rozložení", detail: "Model celkového výnosu s reinvesticí. Mix se každý měsíc vrací k cílovým vahám." },
    { term: "Měna", detail: "Kč je zobrazovací jednotka. Výpočet neobsahuje převod měny ani FX." },
    { term: "Co v tom není", detail: "Další vklady, výběry, poplatky, daně, inflace ani měnové vlivy." },
  ],
  method: [
    "Všech 132 výnosů je vymyšlených. Nejde o živé ceny ani historické tržní výnosy. Předpoklad reinvestice je součástí syntetického modelu, nikoli záznam skutečně vyplacených dividend.",
  ],
  periodHint: "Stejný pokus může v jiném období dopadnout jinak. Letopočty označují vymyšlenou řadu.",
  amountHint: "Jen pro tenhle pokus. Stejnou částku vložíme do obou cest na začátku. Žádné další vklady.",
  runHint: "Počítá se z ukázkových dat. Nic se nekupuje.",
  scope: "Výsledek popisuje jen zvolený syntetický vzorek.",
};

const rebalanceLabels: Record<RebalanceRule, string> = {
  annual: "Jednou ročně, na konci prosince",
  monthly: "Každý měsíc",
  none: "Nikdy, váhy se posouvají s cenami",
};
export const rebalanceOptions = (Object.keys(rebalanceLabels) as RebalanceRule[]).map((value) => ({ value, label: rebalanceLabels[value] }));

type HistoryCopyOptions = {
  years?: { start: number; end: number };
  /** A finished run's source; its benchmark wins over `benchmark`. */
  source?: HistorySource;
  /** Benchmark chosen in the setup; defaults to the plan's first. */
  benchmark?: BacktestInstrument;
  /** Costs per trade the numbers include; none by default. */
  costs?: BacktestCosts | null;
};

/**
 * Labels follow provenance, not the mode: only non-deterministic history is „Historická data“.
 * The deterministic run uses the same pipeline on an invented series and stays „Ukázková data“.
 */
export function historySourceCopy(view: BacktestHistoryView, { years = { start: view.firstYear, end: view.lastYear }, source, benchmark = view.benchmarks[0], costs = null }: HistoryCopyOptions = {}): BacktestSourceCopy {
  const sample = view.sample || source?.sample === true;
  const { symbol } = view;
  const b = source?.benchmark ?? benchmark;
  const own = b.symbol === symbol;
  /** Every instrument whose closes the run reads. */
  const symbols = own ? symbol : `${symbol} a ${b.symbol}`;
  const currency = source?.currency ?? "USD";
  const span = `${years.start}–${years.end}`;
  const loaded = source && !sample ? ` · ${view.sourceName}, načteno ${formatDate(source.retrievedAt, { timeZone: "UTC" })}` : "";
  const perTrade = costs && `${formatCostRate(costs.rateBps)} z hodnoty obchodu${costs.fixedFee > 0 ? ` + ${formatBacktestMoney(costs.fixedFee, currency)} za obchod` : ""}`;
  return {
    label: sample ? `Ukázková data · ukázková řada ${symbol} · ${span}` : `Historická data · ${view.sourceName} · ${span}`,
    chart: {
      tag: sample ? "Ukázková data" : "Historická data",
      note: sample ? `Vymyšlen${own ? "á řada" : "é řady"}, měsíční uzávěrky. Nic z grafu nepředpovídá budoucí výnosy.` : `Minulé měsíční uzávěrky ${symbols}. Nic z grafu nepředpovídá budoucí výnosy.`,
      details: `${currency} · jen cena, bez dividend · ${perTrade ? `náklady ${perTrade}, bez daní` : "bez poplatků a daní"} · přímé spojnice měsíčních uzávěrek${loaded}`,
    },
    notes: [
      { term: "Zdroj", detail: sample ? `${view.instrumentName}${own ? "" : ` a ${b.name}`}. Vymyšlené denní ceny Investníku, ne skutečné tržní ceny.` : `${view.sourceName} · denní závěrečné ceny ${symbol} (${view.instrumentName})${own ? "" : ` a ${b.symbol} (${b.name})`}.` },
      { term: "Benchmark", detail: `${benchmarkName(b.symbol)}: celá částka jednou koupí ${b.symbol} na začátku a drží ho. Žádné rebalancování ani obchody. Stejné období, částka, měna i výnos jen z ceny jako u strategie.` },
      { term: "Dostupné období", detail: `Leden ${view.firstYear} – prosinec ${view.lastYear} · měsíční uzávěrky` },
      { term: "Výnos", detail: "Cenový výnos bez dividend. Ceny jsou očištěné jen o splity, takže celkový výnos s dividendami by byl vyšší." },
      { term: "Měsíční data", detail: "Poslední závěrečná cena každého měsíce. Chybí-li měsíc, backtest se nespustí. Nic nedoplňujeme." },
      { term: "Měna", detail: `${currency}, měna kotace ${symbols}. Bez převodu na koruny, takže v tom není ani vliv kurzu.` },
      { term: "Náklady obchodů", detail: perTrade ? `${perTrade}. Strategie je platí při nákupu na začátku a při každém rebalancování nebo přepnutí, benchmark jen při nákupu.` : "Nezapočítané. Zapni je v nastavení a porovnej výsledek s náklady a bez nich." },
      { term: "Co v tom není", detail: `Dividendy, úrok z hotovosti, ${perTrade ? "" : "poplatky, "}daně, spready, inflace ani další vklady.` },
    ],
    method: [
      sample
        ? `${own ? `Řada ${symbol} je vymyšlená` : `Řady ${symbols} jsou vymyšlené`}. Počítá se ale stejně jako skutečné ceny: denní ceny → měsíční uzávěrky → simulace.`
        : `Ceny ${symbols} načítá server ze zdroje ${view.sourceName}. Jsou to minulé závěrečné ceny, ne živé kotace. Hodnoty z prohlížeče se do výpočtu nedostanou.`,
      "Hotovost nenese úrok. Mix s pevnými vahami se mezi rebalancováními posouvá podle cen. Trendový filtr se na konci měsíce rozhoduje jen podle uzávěrek do toho dne: porovná uzávěrku s průměrem posledních 10 měsíčních uzávěrek. Budoucí ceny nezná.",
      "Náklady obchodů, když je zapneš: každý nákup nebo prodej jednoho instrumentu stojí poplatek z objemu × hodnota obchodu plus fixní poplatek. Platí se z portfolia v okamžiku obchodu, takže potom drží přesně cílové váhy toho, co zbylo. Hodnota na konci měsíce je před obchody v tu uzávěrku, proto se náklady projeví v dalším měsíci. Na konci se nic neprodává, i to by stálo poplatek. Stejné uzávěrky se spočítají ještě jednou bez nákladů. Dopad je rozdíl výsledku s náklady a bez nich; u CAGR v procentních bodech ročně.",
    ],
    periodHint: sample ? "Stejný pokus může v jiném období dopadnout jinak. Řada je vymyšlená." : `Stejný pokus může v jiném období dopadnout jinak. Roky odpovídají skutečným cenám ${symbols}.`,
    amountHint: `Jen pro tenhle pokus, v ${currency}, měně kotace ${symbol}. Stejnou částku vložíme do obou cest na začátku. Žádné další vklady.`,
    runHint: `Počítá se z cenové historie ${symbols}. Nic se nekupuje.`,
    scope: sample ? `Výsledek popisuje jen vymyšlen${own ? "ou řadu" : "é řady"}.` : `Výsledek popisuje jen minulé ceny ${symbols} ve zvoleném období, bez dividend.`,
  };
}
