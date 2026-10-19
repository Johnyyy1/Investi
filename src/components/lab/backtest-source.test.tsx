import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { backtestHistoryPlans, historyView, type BacktestInstrument, type HistorySource } from "@/features/backtesting/catalog";
import { BacktestChart } from "./backtest-chart";
import { historySourceCopy, sampleSourceCopy } from "./backtest-source";

vi.mock("@/features/backtesting/actions", () => ({ runHistoryBacktestAction: vi.fn() }));
const { BacktestingLab } = await import("./backtesting-lab");

const fmp = historyView(backtestHistoryPlans.fmp);
const deterministic = historyView(backtestHistoryPlans.deterministic);
const spy = backtestHistoryPlans.fmp.benchmarks[0];
const aapl = backtestHistoryPlans.fmp.benchmarks[1];
const source = (sample: boolean, benchmark: BacktestInstrument = spy): HistorySource => ({ kind: "history", sample, sourceName: "Financial Modeling Prep", symbol: "SPY", instrumentName: "SPDR S&P 500 ETF Trust", benchmark, currency: "USD", adjustment: "split-adjusted", firstMonth: "2019-12", lastMonth: "2021-12", lastCloseDate: "2021-12-31", retrievedAt: "2026-10-18T08:00:00.000Z" });

describe("backtest source labels", () => {
  it("names FMP history as historical, price-only and in its quote currency", () => {
    const copy = historySourceCopy(fmp);
    expect(copy.label).toBe("Historická data · Financial Modeling Prep · 2008–2025");
    expect(copy.chart.tag).toBe("Historická data");
    expect(copy.chart.details).toContain("USD · jen cena, bez dividend");
    expect(copy.notes.map((note) => note.detail).join(" ")).toMatch(/bez dividend/);
    expect(copy.notes.map((note) => note.detail).join(" ")).toMatch(/Bez převodu na koruny/);
    expect(historySourceCopy(fmp, { years: { start: 2020, end: 2021 }, source: source(false) }).chart.details).toContain("Financial Modeling Prep, načteno 18. 10. 2026");
  });
  it("says which costs per trade the numbers include", () => {
    const without = historySourceCopy(fmp);
    expect(without.chart.details).toContain("bez poplatků a daní");
    expect(without.notes.find((note) => note.term === "Náklady obchodů")?.detail).toMatch(/^Nezapočítané/);
    const withCosts = historySourceCopy(fmp, { costs: { rateBps: 10, fixedFee: 1.5 } });
    expect(withCosts.chart.details.replace(/\s/g, " ")).toMatch(/náklady 0,1 % z hodnoty obchodu \+ 1,5 \$ za obchod, bez daní/);
    expect(withCosts.notes.find((note) => note.term === "Náklady obchodů")?.detail).toMatch(/benchmark jen při nákupu/);
    expect(withCosts.notes.find((note) => note.term === "Co v tom není")?.detail).not.toMatch(/poplatky/);
  });
  it("never calls deterministic or synthetic closes historical", () => {
    for (const copy of [historySourceCopy(deterministic), historySourceCopy(fmp, { years: { start: 2020, end: 2021 }, source: source(true) }), historySourceCopy(deterministic, { benchmark: deterministic.benchmarks[1] }), sampleSourceCopy]) {
      expect(copy.label).toMatch(/^Ukázková data/);
      expect(copy.chart.tag).toBe("Ukázková data");
      expect(JSON.stringify(copy)).not.toMatch(/historická data|live|real-time|aktuální cena/i);
    }
    expect(historySourceCopy(deterministic).label).toBe("Ukázková data · ukázková řada SPX · 2016–2025");
  });
  it("describes the buy-and-hold benchmark and names every instrument the run reads", () => {
    const own = historySourceCopy(fmp);
    expect(own.notes.find((note) => note.term === "Benchmark")?.detail).toMatch(/^Buy-and-hold SPY: celá částka jednou koupí SPY na začátku a drží ho. Žádné rebalancování ani obchody./);
    expect(own.runHint).toBe("Počítá se z cenové historie SPY. Nic se nekupuje.");
    const other = historySourceCopy(fmp, { years: { start: 2020, end: 2021 }, source: source(false, aapl) });
    expect(other.notes.find((note) => note.term === "Benchmark")?.detail).toMatch(/^Buy-and-hold AAPL:/);
    expect(other.chart.note).toContain("Minulé měsíční uzávěrky SPY a AAPL");
    expect(other.scope).toBe("Výsledek popisuje jen minulé ceny SPY a AAPL ve zvoleném období, bez dividend.");
    expect(historySourceCopy(fmp, { benchmark: aapl }).runHint).toBe("Počítá se z cenové historie SPY a AAPL. Nic se nekupuje.");
  });
  it("labels a history chart in USD with its own benchmark", () => {
    const html = renderToStaticMarkup(createElement(BacktestChart, { strategyLabel: "SPY 60 % + hotovost 40 %", benchmarkLabel: "Buy-and-hold SPY", currency: "USD", source: historySourceCopy(fmp).chart, initial: 10_000, data: [{ label: "2019-12", value: 10_000, benchmark: 10_000 }, { label: "2020-01", value: 9_800.5, benchmark: 9_700 }] }));
    expect(html).toContain("Hodnota v USD, měsíc po měsíci");
    expect(html).toContain("Historická data");
    expect(html).toContain("B · Buy-and-hold SPY");
    expect(html).toMatch(/9\s801\s\$/);
    expect(html).not.toContain("Akciový vzorek");
    expect(html).not.toContain("Kč");
  });
});

describe("Backtesting setup", () => {
  it("keeps the synthetic sample as the default and offers the configured history", () => {
    const html = renderToStaticMarkup(createElement(BacktestingLab, { history: fmp }));
    expect(html).toContain("1 · Data");
    expect(html).toContain("Ukázkový vzorek");
    expect(html).toContain("Cenová historie SPY");
    expect(html).toContain("Historická data · Financial Modeling Prep · 2008–2025");
    expect(html).toContain('data-source="sample"');
    expect(html).toContain("Ukázková data · syntetické výnosy");
    expect(html).toContain("Mix 60 / 30 / 10");
    expect(html).not.toContain('id="rebalance"');
    expect(html).not.toContain('id="benchmark"');
    expect(html).toContain("Buy-and-hold akciového vzorku");
    expect(html).not.toContain("Akciový vzorek");
  });
  it("names the deterministic history as a sample series", () => {
    const html = renderToStaticMarkup(createElement(BacktestingLab, { history: deterministic }));
    expect(html).toContain("Ukázková řada SPX");
    expect(html).not.toContain("Historická data");
  });
  it("renders the sample-only page without a data step", () => {
    const html = renderToStaticMarkup(createElement(BacktestingLab, {}));
    expect(html).not.toContain("1 · Data");
    expect(html).toContain("1 · Dvě cesty");
  });
});
