import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DemoButton } from "@/components/auth/demo-button";
import styles from "./marketing.module.css";

export function Hero() {
  return <section aria-labelledby="hero-title" className={styles.hero}>
    <div className={`${styles.container} ${styles.heroLayout}`}>
      <div className={styles.heroContent}>
        <h1 id="hero-title" className={styles.heroTitle}><span>Uč se investovat</span> <span>praxí.</span></h1>
        <p className={styles.heroCopy}>Interaktivní lekce, portfolio experimenty a backtesty —<br className={styles.desktopBreak} /> od první akcie po kvantitativní investování.</p>
        <div className={styles.heroActions}>
          <Link href="/onboarding" prefetch={false} className={`${styles.button} ${styles.primaryButton}`}>Začít se učit <ArrowRight aria-hidden="true" /></Link>
          <DemoButton compact className={styles.demo} buttonClassName={`${styles.button} ${styles.demoButton}`} />
        </div>
      </div>
      <div className={styles.heroVisual} data-asset-state="ready" aria-hidden="true">
        <Image
          src="/brand/mascot-hero.webp"
          width={1536}
          height={1024}
          sizes="(max-width: 919px) calc(100vw - 40px), (max-width: 1200px) 52vw, 710px"
          preload
          alt=""
          aria-hidden="true"
          className={styles.heroImage}
        />
        <Image
          src="/brand/sun.webp"
          width={1024}
          height={1024}
          sizes="(max-width: 767px) 24vw, (max-width: 919px) 120px, (max-width: 1220px) 130px, 150px"
          alt=""
          aria-hidden="true"
          className={`${styles.heroAtmosphere} ${styles.heroSun}`}
        />
        <Image
          src="/brand/cloud.webp"
          width={1536}
          height={1024}
          sizes="(max-width: 767px) 28vw, (max-width: 919px) 132px, (max-width: 1220px) 140px, 152px"
          alt=""
          aria-hidden="true"
          className={`${styles.heroAtmosphere} ${styles.heroCloud} ${styles.heroCloudOne}`}
        />
        <Image
          src="/brand/cloud.webp"
          width={1536}
          height={1024}
          sizes="(max-width: 919px) 94px, (max-width: 1220px) 98px, 106px"
          alt=""
          aria-hidden="true"
          className={`${styles.heroAtmosphere} ${styles.heroCloud} ${styles.heroCloudTwo}`}
        />
        <Image
          src="/brand/cloud.webp"
          width={1536}
          height={1024}
          sizes="(max-width: 1220px) 108px, 120px"
          alt=""
          aria-hidden="true"
          className={`${styles.heroAtmosphere} ${styles.heroCloud} ${styles.heroCloudThree}`}
        />
      </div>
    </div>
  </section>;
}
