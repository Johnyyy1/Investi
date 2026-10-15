import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./marketing.module.css";
import { PORTFOLIO_LAB_UNLOCK_CAPITAL_MINOR, PORTFOLIO_LAB_UNLOCK_ID, progressionUnlocks } from "@/features/progression/unlocks";
import { formatPracticeCapitalMinor } from "@/features/rewards/presentation";

const portfolioLabUnlock = progressionUnlocks[PORTFOLIO_LAB_UNLOCK_ID];
const completedLessons = portfolioLabUnlock.prerequisiteLessonIds.length;
const availableLessons = 10;
const examplePracticeCapital = formatPracticeCapitalMinor(PORTFOLIO_LAB_UNLOCK_CAPITAL_MINOR);
const exampleStreak = 4;

export function ProgressShowcase() {
  return <section aria-labelledby="progress-showcase-title" className={styles.progressShowcase}>
    <div className={`${styles.container} ${styles.progressShowcaseLayout}`}>
      <div className={styles.progressCopy}>
        <p className={styles.progressEyebrow}>POKROK</p>
        <h2 id="progress-showcase-title">Udrž si rytmus.<span>Sleduj, jak rosteš.</span></h2>
        <p className={styles.progressDescription}>Krátké lekce se sčítají. Udrž si rytmus, získej XP, odemkni Portfolio Lab a sleduj, jak rostou tvé znalosti.</p>
        <Link href="/onboarding" prefetch={false} className={`${styles.button} ${styles.primaryButton} ${styles.progressCta}`}>Začít se učit <ArrowRight aria-hidden="true" /></Link>
      </div>

      <div className={styles.progressScene} data-testid="progress-showcase-demo">
        <p className={styles.progressPreviewLabel}>Ilustrační náhled pokroku</p>

        <div className={styles.progressStats}>
          <div className={`${styles.progressStat} ${styles.streakStat}`}>
            <Image src="/brand/flame-icon.webp" width={92} height={92} sizes="72px" alt="" aria-hidden="true" className={styles.progressStatImage} />
            <span><small>Současný rytmus</small><strong>{exampleStreak} dny</strong></span>
          </div>
          <div className={`${styles.progressStat} ${styles.capitalStat}`}>
            <Image src="/brand/growing-coin.webp" width={92} height={92} sizes="72px" alt="" aria-hidden="true" className={styles.progressStatImage} />
            <span><small>Získaný Practice Capital</small><strong>{examplePracticeCapital}</strong></span>
          </div>
        </div>

        <div className={styles.progressSurface}>
          <div className={styles.progressSurfaceHeader}>
            <span><small>Tvůj pokrok</small><strong>Výukový plán investování</strong></span>
            <b>{Math.round((completedLessons / availableLessons) * 100)}%</b>
          </div>
          <div className={styles.progressLessonCount}>
            <strong>{completedLessons} z {availableLessons} lekcí dokončeno</strong>
            <span>Pokrok se průběžně ukládá</span>
          </div>
          <progress className={styles.progressBar} max={availableLessons} value={completedLessons} aria-label={`${completedLessons} z ${availableLessons} lekcí dokončeno`}>{completedLessons} z {availableLessons} lekcí dokončeno</progress>
          <div className={styles.progressReward}>
            <span className={styles.rewardDot} aria-hidden="true" />
            <span><small>Milník základů</small><strong>{portfolioLabUnlock.xpRequired} XP · Portfolio Lab odemčen</strong></span>
          </div>
        </div>

        <div className={styles.progressObjects} aria-hidden="true">
          <span className={styles.progressObjectGlow} />
          <Image src="/brand/gold-icon.webp" width={260} height={260} sizes="(max-width: 520px) 150px, 220px" alt="" className={styles.progressTrophy} />
          <Image src="/brand/books-icon.webp" width={240} height={240} sizes="(max-width: 520px) 145px, 200px" alt="" className={styles.progressBooks} />
        </div>
      </div>
    </div>
  </section>;
}
