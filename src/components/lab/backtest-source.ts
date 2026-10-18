import type { BacktestHistoryView, HistorySource } from "@/features/backtesting/catalog";
import type { RebalanceRule } from "@/features/backtesting/spec";
import { formatDate } from "@/lib/formatters";
import type { BacktestChartSource } from "./backtest-chart";

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
    { term: "Zdroj", detail: "Syntetický měsíční vzorek vytvořený pro investi. Žádná tržní pozorování." },
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

/**
 * Labels follow provenance, not the mode: only non-deterministic history is „Historická data“.
 * The deterministic run uses the same pipeline on an invented series and stays „Ukázková data“.
 */
export function historySourceCopy(view: BacktestHistoryView, years: { start: number; end: number } = { start: view.firstYear, end: view.lastYear }, source?: HistorySource): BacktestSourceCopy {
  const sample = view.sample || source?.sample === true;
  const { symbol } = view;
  const currency = source?.currency ?? "USD";
  const span = `${years.start}–${years.end}`;
  const loaded = source && !sample ? ` · ${view.sourceName}, načteno ${formatDate(source.retrievedAt, { timeZone: "UTC" })}` : "";
  return {
    label: sample ? `Ukázková data · ukázková řada ${symbol} · ${span}` : `Historická data · ${view.sourceName} · ${span}`,
    chart: {
      tag: sample ? "Ukázková data" : "Historická data",
      note: sample ? "Vymyšlená řada, měsíční uzávěrky. Nic z grafu nepředpovídá budoucí výnosy." : `Minulé měsíční uzávěrky ${symbol}. Nic z grafu nepředpovídá budoucí výnosy.`,
      details: `${currency} · jen cena, bez dividend · bez poplatků a daní · přímé spojnice měsíčních uzávěrek${loaded}`,
    },
    notes: [
      { term: "Zdroj", detail: sample ? `${view.instrumentName}. Vymyšlené denní ceny investi, ne skutečný index.` : `${view.sourceName} · denní závěrečné ceny ${symbol} (${view.instrumentName}).` },
      { term: "Dostupné období", detail: `Leden ${view.firstYear} – prosinec ${view.lastYear} · měsíční uzávěrky` },
      { term: "Výnos", detail: "Cenový výnos bez dividend. Ceny jsou očištěné jen o splity, takže celkový výnos s dividendami by byl vyšší." },
      { term: "Měsíční data", detail: "Poslední závěrečná cena každého měsíce. Chybí-li měsíc, backtest se nespustí. Nic nedoplňujeme." },
      { term: "Měna", detail: `${currency}, měna kotace ${symbol}. Bez převodu na koruny, takže v tom není ani vliv kurzu.` },
      { term: "Co v tom není", detail: "Dividendy, úrok z hotovosti, poplatky, daně, spready, inflace ani další vklady." },
    ],
    method: [
      sample
        ? `Řada ${symbol} je vymyšlená. Počítá se ale stejně jako skutečné ceny: denní ceny → měsíční uzávěrky → simulace.`
        : `Ceny ${symbol} načítá server ze zdroje ${view.sourceName}. Jsou to minulé závěrečné ceny, ne živé kotace. Hodnoty z prohlížeče se do výpočtu nedostanou.`,
      "Hotovost nenese úrok. Mix s pevnými vahami se mezi rebalancováními posouvá podle cen. Trendový filtr se na konci měsíce rozhoduje jen podle uzávěrek do toho dne: porovná uzávěrku s průměrem posledních 10 měsíčních uzávěrek. Budoucí ceny nezná.",
    ],
    periodHint: sample ? "Stejný pokus může v jiném období dopadnout jinak. Řada je vymyšlená." : `Stejný pokus může v jiném období dopadnout jinak. Roky odpovídají skutečným cenám ${symbol}.`,
    amountHint: `Jen pro tenhle pokus, v ${currency}, měně kotace ${symbol}. Stejnou částku vložíme do obou cest na začátku. Žádné další vklady.`,
    runHint: `Počítá se z cenové historie ${symbol}. Nic se nekupuje.`,
    scope: sample ? "Výsledek popisuje jen vymyšlenou řadu." : `Výsledek popisuje jen minulé ceny ${symbol} ve zvoleném období, bez dividend.`,
  };
}
