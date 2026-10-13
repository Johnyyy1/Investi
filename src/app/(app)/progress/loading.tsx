import styles from "@/components/progress/progress-overview.module.css";

/** Neutral placeholder: no counts, XP or balances until authoritative data arrives.
 * No h1 here: the streamed page keeps the only page heading. */
export default function ProgressLoading() {
  return <main className={styles.page} aria-busy="true"><div className={styles.container}>
    <header className={styles.loading}><p className={styles.eyebrow}>Pokrok</p><p className={styles.loadingTitle}>Co už umíš</p><p role="status">Načítáme tvoje hotové lekce a uložený pokrok…</p></header>
    <div className={styles.skeleton} aria-hidden="true" />
  </div></main>;
}
