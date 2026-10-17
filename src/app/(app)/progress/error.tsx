"use client";

import { AppLink as Link } from "@/components/shell/app-link";
import { ArrowRight, RotateCcw } from "lucide-react";
import { GuideImage } from "@/components/guide-image";
import paper from "@/components/learning/studovna-page.module.css";
import styles from "@/components/progress/progress-overview.module.css";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Design System §04 failure state: no zeros, no stale numbers, no technical detail. */
export default function ProgressError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className={styles.page}><div className={styles.container}>
    <section className={styles.failure} aria-labelledby="progress-error-title">
      <div className={styles.guideWrap}><div className={styles.bubble}><p>Hledám to. Občas to chvilku trvá.</p></div><GuideImage className={styles.guide} pose="20-searching-box" alt="" sizes="230px" /></div>
      <div className={styles.failureCard}>
        <div className={styles.failureHead}><p className={styles.eyebrow}>Něco chybí</p><p className={styles.meta}>Pokrok</p></div>
        <h1 id="progress-error-title">Tvůj pokrok se teď nenačetl.</h1>
        <p role="alert">Nic se neztratilo. Hotové lekce i uložené kroky zůstávají u tvého účtu, jen je teď neumíme zobrazit. Proto tu nejsou žádná čísla.</p>
        <button type="button" className={cn(buttonVariants(), paper.primaryAction, styles.primary)} onClick={() => retry()}>Načíst znovu<RotateCcw size={18} aria-hidden="true" /></button>
        <Link className={styles.textLink} href="/learn">Mezitím otevřít Učení<ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </section>
  </div></main>;
}
