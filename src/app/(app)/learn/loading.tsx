import styles from "@/components/learning/studovna-page.module.css";

export default function LearnLoading() {
  return <main className={`investi-theme ${styles.page}`} aria-busy="true"><div className={styles.container}><header className={styles.greeting}><p className={styles.loadingTitle}>Studovna</p><p role="status">Načítáme tvoje lekce a uložený pokrok…</p></header></div></main>;
}
