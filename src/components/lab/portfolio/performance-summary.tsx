import type { PortfolioPerformance, PerformanceReason } from "@/features/portfolio/performance";
import { metricAnchor, metricEntry, metricExplanation, metricLessonLink, type MetricId } from "@/features/learning/metric-glossary";
import { AppLink as Link } from "@/components/shell/app-link";
import { percent } from "./lab-model";
import styles from "./portfolio-lab.module.css";

const reasons: Record<PerformanceReason, string> = {
  "missing-valuation": "Chybí úplné ocenění nebo historické ceny či kurzy.",
  "no-capital": "Výnos lze měřit až od prvního vkladu cvičného kapitálu.",
  "no-period": "Pro měření výnosu musí od prvního vkladu uplynout čas.",
  "invalid-ledger": "Časová řada vkladů a obchodů zatím není úplná.",
  "zero-boundary": "Nulová hodnota před dalším vkladem neumožňuje spojit dílčí výnosy.",
  "no-solution": "Pro tyto peněžní toky se výnos nepodařilo spolehlivě určit.",
};

export function PerformanceSummary({ performance }: { performance: PortfolioPerformance }) {
  const metrics = [["time-weighted-return", performance.twr], ["money-weighted-return", performance.mwr]] as const;
  const from = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric" }).format(new Date(performance.startedAt));
  const to = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric" }).format(new Date(performance.endedAt));
  return <div className={styles.performance}>
    <dl className={styles.performanceMetrics}>{metrics.map(([id, metric]) => <div key={id} id={metricAnchor(id)}>
      <dt>{metricEntry(id).name}</dt>
      <dd className={styles.num} data-testid={id}>{metric.status === "available" ? <>{percent(metric.annualizedBasisPoints ?? metric.basisPoints, { signed: true, digits: 2 })}<small>{metric.annualizedBasisPoints === null ? "za období" : "ročně"}{id === "time-weighted-return" && performance.twrMethod === "prior-daily-close-estimate" ? " · odhad" : ""}</small></> : "Nedostupné"}</dd>
    </div>)}</dl>
    <details className={styles.performanceDetails}>
      <summary>Jak výnosy počítáme</summary>
      <p>Od {from} do {to}, v Kč, včetně hotovosti a zaznamenaných nákladů. Roční přepočet zobrazujeme až za období alespoň 365 dní. Dividendy a úročení hotovosti nejsou v evidenci zahrnuté. Reset zahajuje nové období.</p>
      {metrics.map(([id, metric]) => <p key={id}><strong>{metricEntry(id).name}: </strong>{metricExplanation(id, "portfolio")}{metric.status === "unavailable" ? <> {reasons[metric.reason]}</> : metric.annualizedBasisPoints !== null ? <> Za celé období {percent(metric.basisPoints, { signed: true, digits: 2 })}.</> : null} <Lesson id={id} /></p>)}
    </details>
  </div>;
}

function Lesson({ id }: { id: MetricId }) {
  const lesson = metricLessonLink(id);
  return lesson ? <Link href={lesson.href}>{lesson.label}</Link> : <span>Lekce 3.1.6 se připravuje.</span>;
}
