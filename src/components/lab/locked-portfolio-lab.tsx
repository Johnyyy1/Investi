import Link from "next/link";
import { ArrowLeft, ArrowRight, Circle, CircleCheck, LockKeyhole } from "lucide-react";
import styles from "@/components/lab/portfolio/portfolio-lab.module.css";
import type { evaluateUnlock } from "@/features/progression/unlocks";

type UnlockStatus = ReturnType<typeof evaluateUnlock>;

/** The real unlock conditions, in the Portfolio Lab paper style; no balances or trading. */
export function LockedPortfolioLab({ unlock }: { unlock: UnlockStatus }) {
  const lessonsDone = unlock.prerequisitesComplete;
  const xpDone = unlock.totalXp >= unlock.xpRequired;
  return <main className={`investi-theme ${styles.page}`}><div className={`${styles.container} ${styles.locked}`}>
    <Link href="/lab" className={styles.textLink}><ArrowLeft size={16} aria-hidden="true" />Lab</Link>
    <div className={styles.eyebrowRow}><LockKeyhole size={16} aria-hidden="true" className={styles.lockIcon} /><p className={styles.eyebrow}>Zamčeno · odemkni učením</p></div>
    <h1>Portfolio Lab</h1>
    <p className={styles.lockedLead}>Nejdřív zvládni základy, potom si z cvičného kapitálu sestav první portfolio.</p>
    <section className={`${styles.card} ${styles.lockedCard}`} aria-label="Podmínky odemčení">
      <ul>
        <li>{lessonsDone ? <CircleCheck size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}<span>Základy investování</span><span className={styles.num}>{unlock.completedPrerequisiteLessons} / {unlock.requiredPrerequisiteLessons} lekcí</span></li>
        <li>{xpDone ? <CircleCheck size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}<span>Body za lekce</span><span className={styles.num}>{unlock.totalXp} / {unlock.xpRequired} XP</span></li>
      </ul>
      <p className={styles.meta}>Dokonči všech sedm lekcí Základů investování a získej 420 XP. Odemčením dostaneš jednorázově 5 000 Kč cvičného kapitálu.</p>
    </section>
    <Link href="/learn" className={styles.primary}>Pokračovat v učení<ArrowRight size={18} aria-hidden="true" /></Link>
  </div></main>;
}
