"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import styles from "@/components/learning/studovna-page.module.css";

export default function LearnError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className={styles.page}><div className={styles.container}><header className={styles.greeting}><h1>Tvůj pokrok se teď nenačetl.</h1><p>Uložené lekce zůstávají u tvého účtu. Zkus stránku načíst znovu.</p></header><section className={styles.loadError} aria-label="Načtení studia se nezdařilo"><Image src="/investi-assets/guide/05-shrug.webp" width={686} height={686} sizes="220px" alt="" /><button className={styles.primaryAction} onClick={retry}>Zkusit znovu<ArrowRight size={18} aria-hidden="true" /></button></section></div></main>;
}
