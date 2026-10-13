import styles from "@/components/lab/portfolio/portfolio-lab.module.css";

/** Neutral placeholder: no balances, values or weights until the ledger and prices arrive. */
export default function PortfolioLabLoading() {
  return <main className={styles.page} aria-busy="true"><div className={styles.container}>
    <div className={styles.eyebrowRow}><p className={styles.eyebrow}>Portfolio Lab</p></div>
    <p role="status" className={styles.meta} style={{ marginTop: 12 }}>Načítáme tvoje cvičné portfolio a aktuální ceny…</p>
    <div className={styles.skeleton} aria-hidden="true" />
  </div></main>;
}
