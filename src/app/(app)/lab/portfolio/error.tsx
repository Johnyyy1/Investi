"use client";

import Image from "next/image";
import { AppLink as Link } from "@/components/shell/app-link";
import { ArrowRight, RotateCcw } from "lucide-react";
import styles from "@/components/lab/portfolio/portfolio-lab.module.css";

/** Design System failure spec: no zeros, no stale numbers, no technical detail. */
export default function PortfolioLabError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className={`investi-theme ${styles.page}`}><div className={styles.container}>
    <div className={styles.missing}>
      <div className={styles.missingScene}>
        <p className={styles.bubble}>Hledám to. Občas to chvilku trvá.</p>
        <Image className={styles.guide} src="/investi-assets/guide/20-searching-box.webp" alt="" width={872} height={654} sizes="230px" />
      </div>
      <section className={`${styles.card} ${styles.missingCard}`} aria-labelledby="lab-error-title">
        <div className={styles.emptyHead}><p className={styles.sectionLabel}>Něco chybí</p><p className={styles.meta}>Portfolio Lab</p></div>
        <h1 id="lab-error-title" style={{ marginTop: 10, fontSize: "1.5625rem", lineHeight: 1.15 }}>Portfolio se teď nenačetlo.</h1>
        <p role="alert">Nic se neztratilo. Obchody, mix i cvičný kapitál zůstávají u tvého účtu, jen je teď neumíme zobrazit. Proto tu nejsou žádná čísla.</p>
        <button type="button" className={styles.primary} onClick={() => retry()}>Načíst znovu<RotateCcw size={18} aria-hidden="true" /></button>
        <Link className={styles.textLink} href="/learn">Mezitím otevřít Studovnu<ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
    </div>
  </div></main>;
}
