import styles from "@/components/settings/settings.module.css";
export default function SettingsLoading() {
  return <main className={styles.page} aria-busy="true"><div className={styles.heading}><h1>Profil a nastavení</h1><p role="status">Načítám nastavení…</p></div><div className={styles.card} style={{ minHeight: 240 }} aria-hidden="true" /></main>;
}
