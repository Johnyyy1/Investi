"use client";
import { Button } from "@/components/ui/button";
import styles from "@/components/settings/settings.module.css";
export default function SettingsError({ reset }: { reset: () => void }) {
  return <main className={styles.page}><div className={styles.heading}><h1>Nastavení se nepodařilo načíst</h1><p role="alert">Zkus stránku načíst znovu. Už uložené údaje zůstávají u tvého účtu.</p></div><Button onClick={reset}>Zkusit znovu</Button></main>;
}
