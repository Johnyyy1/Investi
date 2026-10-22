import { FinanceInput } from "@/components/learning/finance-input";
import { Select } from "@/components/ui/form-controls";
import { FinancialInputError, parsePrice } from "@/features/finance/returns";
import { experimentSettingsSchema, type ExperimentSettings } from "@/features/backtesting/spec";
import type { HistoryBacktestResult } from "@/features/backtesting/catalog";
import { formatPercentage } from "@/lib/formatters";
import { formatBacktestMoney, formatSharpeRatio } from "./backtest-model";
import styles from "./backtesting-lab.module.css";

export type ExperimentDraft = { monthly: string; split: string; fundCost: string; withdrawal: string; withdrawalKind: "amount" | "rate"; holdout: string };
export const emptyExperimentDraft: ExperimentDraft = { monthly: "0", split: "1", fundCost: "0", withdrawal: "0", withdrawalKind: "amount", holdout: "" };

export function parseExperimentDraft(draft: ExperimentDraft): ExperimentSettings {
  const monthly = parsePrice(draft.monthly.replace(",", "."), "Měsíční příspěvek"), withdrawal = parsePrice(draft.withdrawal.replace(",", "."), "Měsíční výběr / roční míra");
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(draft.fundCost.trim());
  if (!match) throw new FinancialInputError("Roční nákladovost zadej nezáporně, nejvýš na dvě desetinná místa.");
  const bps = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  const parsed = experimentSettingsSchema.safeParse({
    ...(monthly ? { contributions: { monthlyAmount: monthly } } : {}),
    ...(draft.split !== "1" ? { lumpSumSplit: { months: Number(draft.split) } } : {}),
    ...(bps ? { annualFundCostBps: bps } : {}),
    ...(withdrawal ? { withdrawals: draft.withdrawalKind === "amount" ? { monthlyAmount: withdrawal } : { annualRate: withdrawal / 100 } } : {}),
    ...(draft.holdout ? { outOfSampleStartMonth: `${draft.holdout}-01` } : {}),
  });
  if (!parsed.success) throw new FinancialInputError("Zkontroluj experiment: příspěvky a výběry musí být nezáporné, nákladovost nejvýš 20 % a roční míra výběru nejvýš 100 %.");
  return parsed.data;
}

export function ExperimentFields({ draft, onChange, currency, years }: { draft: ExperimentDraft; onChange: (draft: ExperimentDraft) => void; currency: string; years: readonly number[] }) {
  const update = (key: keyof ExperimentDraft, value: string) => onChange({ ...draft, [key]: value });
  return <details className={styles.quiz}>
    <summary>Vklady, čerpání a ověření strategie</summary>
    <div className={styles.formSection}>
      <p className={styles.hint}>Stejný rozpočet a plán toků pro A i B. Příspěvky a výběry proběhnou na konci měsíce. Poslední příspěvek zůstane v hotovosti.</p>
      <div className={`${styles.dates} ${styles.experimentFields}`}>
        <FinanceInput label="Měsíční příspěvek v backtestu" suffix={currency} value={draft.monthly} onValueChange={(value) => update("monthly", value)} />
        <div><label htmlFor="lump-split" className={styles.label}>Rozložení počáteční částky</label><Select id="lump-split" value={draft.split} onChange={(event) => update("split", event.target.value)}>{[1, 3, 6, 12].map((months) => <option key={months} value={months}>{months === 1 ? "Celá částka na začátku" : `${months} stejných částí`}</option>)}</Select><p className={styles.hint}>První část na začátku, další na konci měsíců. Zbytek čeká v hotovosti bez úroku; nejde o nové vklady.</p></div>
        <FinanceInput label="Roční nákladovost fondu" mode="percentage" value={draft.fundCost} onValueChange={(value) => update("fundCost", value)} hint="Modelový roční odpočet z investované části, měsíčně. Navíc k poplatkům za obchod. Historické ceny mohou náklady fondu již zahrnovat." />
        <div><label htmlFor="withdrawal-kind" className={styles.label}>Způsob čerpání</label><Select id="withdrawal-kind" value={draft.withdrawalKind} onChange={(event) => update("withdrawalKind", event.target.value)}><option value="amount">Pevná měsíční částka</option><option value="rate">Roční % počátečního rozpočtu</option></Select></div>
        <FinanceInput label={draft.withdrawalKind === "amount" ? "Měsíční výběr" : "Roční míra výběru"} suffix={draft.withdrawalKind === "amount" ? currency : "%"} value={draft.withdrawal} onValueChange={(value) => update("withdrawal", value)} hint="Roční míra se dělí 12; částka se nezvyšuje s inflací. Nedostatek peněz se zobrazí, bez půjčky." />
        <div><label htmlFor="holdout-year" className={styles.label}>Out-of-sample od ledna</label><Select id="holdout-year" value={draft.holdout} onChange={(event) => update("holdout", event.target.value)}><option value="">Bez rozdělení</option>{years.slice(1).map((year) => <option key={year} value={year}>{year}</option>)}</Select><p className={styles.hint}>Pravidlo i kapitál pokračují beze změny. Rozdělení samo nezaručuje nezávislý test: upravovat strategii podle této části znamená použít ji k ladění.</p></div>
      </div>
    </div>
  </details>;
}

export function ExperimentResults({ result }: { result: HistoryBacktestResult }) {
  const { education, split } = result;
  const money = (value: number) => formatBacktestMoney(value, result.currency);
  return <>
    {education && <section className={styles.metrics} aria-labelledby="flows-heading"><h2 id="flows-heading">Vklady nejsou výnos</h2>
      <p>TWR odděluje vnější toky od výkonu. MWR zohledňuje jejich velikost a čas. Rozdíl sám neprokazuje chybu v chování. Propad a volatilita vycházejí z výnosového indexu, ne ze zůstatku po výběrech.</p>
      <dl className={styles.metricRows}>{([
        ["Vloženo celkem", "contributed"], ["Skutečně vybráno", "withdrawn"], ["Nepokryté výběry", "unfundedWithdrawals"], ["Zisk / ztráta po tocích", "gain"], ["Náklady fondu", "fundCosts"],
      ] as const).map(([label, key]) => <div className={`${styles.metricRow} ${styles.costRow}`} key={key}><dt><strong>{label}</strong></dt><dd><span className={styles.metricSeries}>A</span><strong data-testid={`flow-${key}`}>{money(education.strategy[key])}</strong></dd><dd><span className={styles.metricSeries}>B</span><strong>{money(education.benchmark[key])}</strong></dd></div>)}</dl>
      <p className={styles.hint}>MWR počítáme jako měsíční IRR přepočtené na rok. Při více změnách znaménka toků nebo bez jednoznačného řešení je nedostupné. Čerpání hotovosti není tržní propad; nepokryté výběry posuzuj zvlášť.</p>
    </section>}
    {split && <section className={styles.metrics} aria-labelledby="holdout-heading"><h2 id="holdout-heading">In-sample a out-of-sample</h2><p>Část pro ověření pokračuje se skutečným zůstatkem a stejnými pravidly. Minulé úpravy podle výsledku se nedají rozdělením odčinit.</p>
      {(["inSample", "outOfSample"] as const).map((key) => <div key={key} data-testid={`split-${key}`}><h3>{key === "inSample" ? "In-sample · ladění" : "Out-of-sample · ověření"}</h3><p>{split.strategy[key].startMonth} – {split.strategy[key].endMonth} · {split.strategy[key].months} měsíců</p><dl className={styles.metricRows}>{([
        ["Počáteční zůstatek", (series: typeof split.strategy) => money(series[key].startValue)],
        ["Konečná hodnota", (series: typeof split.strategy) => money(series[key].metrics.finalValue)],
        ["TWR za období", (series: typeof split.strategy) => formatPercentage(series[key].metrics.totalReturn)],
        ["TWR ročně", (series: typeof split.strategy) => formatPercentage(series[key].metrics.cagr)],
        ["MWR ročně", (series: typeof split.strategy) => series[key].mwr === null ? "Nedostupné" : formatPercentage(series[key].mwr)],
        ["Největší propad", (series: typeof split.strategy) => formatPercentage(series[key].metrics.maxDrawdown)],
        ["Volatilita ročně", (series: typeof split.strategy) => formatPercentage(series[key].metrics.volatility)],
        ["Sharpeho poměr", (series: typeof split.strategy) => formatSharpeRatio(series[key].metrics.sharpeRatio)],
      ] as const).map(([label, value]) => <div key={label} className={`${styles.metricRow} ${styles.costRow}`}><dt><strong>{label}</strong></dt><dd><span className={styles.metricSeries}>A</span><strong>{value(split.strategy)}</strong></dd><dd><span className={styles.metricSeries}>B</span><strong>{value(split.benchmark)}</strong></dd></div>)}</dl></div>)}
    </section>}
  </>;
}
