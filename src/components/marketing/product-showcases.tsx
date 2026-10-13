import {
  ArrowLeft,
  ArrowRight,
  Building2,
  GraduationCap,
  Play,
  Share2,
  Wifi,
  Zap,
} from "lucide-react";
import { BacktestingShowcase } from "./backtesting-showcase";
import { PortfolioShowcase } from "./portfolio-showcase";
import { ProgressShowcase } from "./progress-showcase";
import styles from "./marketing.module.css";

function LessonPhone() {
  return <div className={styles.lessonPhone} role="img" aria-label="Obrazovka lekce investi vysvětlující, co je akcie">
    <div className={styles.phoneHardware} aria-hidden="true">
      <div className={styles.phoneScreen}>
        <div className={styles.phoneStatus}>
          <span className={styles.phoneTime}>9:41</span>
          <span className={styles.phoneIsland} />
          <span className={styles.phoneSystemStatus}>
            <span className={styles.phoneCellular}><i /><i /><i /><i /></span>
            <Wifi className={styles.phoneWifi} />
            <span className={styles.phoneBattery}><i /></span>
          </span>
        </div>
        <div className={styles.phoneAppBar}>
          <ArrowLeft />
          <span>Lekce 2 ze 7</span>
          <Share2 />
        </div>
        <div className={styles.phoneScreenContent}>
          <p className={styles.phoneKicker}>Lekce 2 ze 7</p>
          <h3>Akcie a vlastnictví firmy</h3>
          <p className={styles.phoneDefinition}>Akcie představuje malý podíl ve skutečné společnosti. Když společnost roste, může růst i hodnota tvého podílu.</p>
          <div className={styles.lessonVisual}>
            <div className={styles.lessonIllustration}>
              <span className={styles.lessonBuilding}><Building2 /></span>
              <span className={styles.lessonSlice}>
                <span className={styles.lessonFraction}>1 akcie</span>
                <strong>Kousek společnosti</strong>
              </span>
            </div>
            <span className={styles.lessonPlay}><Play fill="currentColor" /></span>
          </div>
          <div className={styles.lessonProgress}>
            <span><i /></span>
            <small>1 ze 6</small>
          </div>
          <span className={styles.lessonNext}>Další lekce <ArrowRight /></span>
        </div>
      </div>
    </div>
  </div>;
}

function ProductFeature({ kind }: { kind: "learn" | "use" }) {
  const learn = kind === "learn";
  const Icon = learn ? GraduationCap : Zap;
  return <div className={`${styles.howFeature} ${learn ? styles.howFeatureLearn : styles.howFeatureUse}`}>
    <span className={styles.howFeatureIcon}><Icon aria-hidden="true" /></span>
    <h3>{learn ? "Uč se po minutách" : "Hned to použij"}</h3>
    <p>{learn
      ? "Jasné interaktivní lekce, které zjednoduší investování."
      : "Použij, co se naučíš, v průvodcích a vzdělávacích scénářích."}</p>
  </div>;
}

export function ProductShowcases() {
  return <>
    <section aria-labelledby="how-it-works-title" className={styles.howWorks}>
      <h2 id="how-it-works-title" className={styles.howWorksTitle}>Jak investi funguje?</h2>
      <div className={`${styles.container} ${styles.howWorksGrid}`}>
        <div className={styles.phoneStage}><LessonPhone /></div>
        <ProductFeature kind="learn" />
        <ProductFeature kind="use" />
      </div>
    </section>

    <PortfolioShowcase />
    <BacktestingShowcase />
    <ProgressShowcase />
  </>;
}
