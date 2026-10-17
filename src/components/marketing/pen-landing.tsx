import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CircleCheck, CircleDashed, LockKeyhole, Play } from "lucide-react";
import { DemoButton } from "@/components/auth/demo-button";
import { LessonPreview, MobileNavigation, PortfolioPreview } from "./pen-interactions";
import { MotionRoot } from "./motion/motion-root";
import { CountUp, SplitHeading, magneticProps } from "./motion/reveal";
import { legalLinks } from "@/components/legal/legal-links";
import styles from "./pen-landing.module.css";

export function PenLanding() {
  return <MotionRoot className={styles.landing}>
    <div className={styles.scrollProgress} data-scroll-progress aria-hidden="true"/>
    <a className={styles.skip} href="#main">Přejít k obsahu</a>
    <header className={styles.siteHeader} data-nav>
      <span className={styles.navBg} data-nav-bg aria-hidden="true"/>
      <div className={styles.container}>
        <Link href="/" className={styles.wordmark} aria-label="investi · úvodní stránka">investi!</Link>
        <nav className={styles.topNav} aria-label="Hlavní navigace">
          <a href="#jak-to-funguje">Jak to funguje</a>
          <a href="#portfolio-lab">Portfolio Lab</a>
          <Link href="/sign-in" prefetch={false} {...magneticProps}>Přihlásit se</Link>
        </nav>
        <MobileNavigation />
      </div>
    </header>
    <main id="main" tabIndex={-1}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.container}>
          <h1 id="hero-title" data-hero-title>Peníze jsou vážné.<br/><span>Učení nemusí být.</span></h1>
          <div className={styles.heroIntro} data-hero-intro>
            <p data-hero-sub>Krátké lekce, praktická cvičení a portfolio nanečisto. Objev investování bez skutečných peněz.</p>
            <div className={styles.heroActions} data-hero-actions>
              <Link className={`${styles.primaryButton} ${styles.shimmerHost}`} href="/onboarding" prefetch={false} data-lift data-press {...magneticProps}>Začít se učit <ArrowRight aria-hidden="true" size={19}/><span className={styles.shimmer} data-shimmer aria-hidden="true"/></Link>
              <a className={styles.textAction} href="#jak-to-funguje">Jak to funguje</a>
            </div>
          </div>
          <div className={styles.heroLessonWrap} data-hero-card role="group" aria-label="Ukázka lekce; nezapisuje pokrok ani neuděluje XP">
            <Image className={styles.heroArt} data-hero-art src="/marketing/v14-curiosity-cropped.webp" alt="" aria-hidden="true" width={512} height={519} sizes="(max-width: 500px) 98px, (max-width: 1100px) 194px, 256px" preload />
            <div className={styles.lessonBrowserHeader}><span className={styles.smallWordmark}>investi!</span><span>Základy investování / Portfolio, váhy a diverzifikace</span><span>Lekce 7 ze 7 · ≈ 10 min</span><span>Ukázka lekce</span></div>
            <LessonPreview hero />
          </div>
          <p className={styles.microDisclaimer}>Ukázka lekce · odpověď a vysvětlení</p>
        </div>
      </section>
      <section className={styles.journey} id="jak-to-funguje" aria-labelledby="journey-title">
        <div className={styles.container}>
          <p className={styles.eyebrow} data-reveal="fade">JAK TO FUNGUJE</p>
          <SplitHeading id="journey-title">Malé kroky.<br/>Velké souvislosti.</SplitHeading>
          <p className={styles.journeyDescription} data-reveal>Nejdřív pochopíš jeden pojem. Pak si ho zkusíš. A postupně zjistíš, jak do sebe investování zapadá.</p>
          <div data-journey-pin>
          <div className={styles.journeyContent}>
            <div className={styles.journeyIllustration} aria-hidden="true" data-journey-art>
              <Image src="/marketing/v14-discovery-edge.webp" alt="" width={685} height={1065} sizes="(max-width: 780px) 250px, (max-width: 1100px) 302px, 397px" />
            </div>
            <div className={styles.courseCard} data-lift data-lift-card data-course-card>
              <Image className={styles.discoveryGripTop} src="/marketing/v14-discovery-top-grip.webp" alt="" aria-hidden="true" width={136} height={86} />
              <Image className={styles.discoveryGripSide} src="/marketing/v14-discovery-side-grip.webp" alt="" aria-hidden="true" width={97} height={115} />
              <span className={styles.cardOverline}>Ukázka kurzu · ilustrační průchod</span>
              <div className={styles.courseHeader}><h3>Základy investování</h3><span>3 / 7</span></div>
              <div className={styles.courseProgress}><span data-course-progress/></div>
              {[["Spoření vs. investování","Hotovo"],["Akcie a vlastnictví firmy","Hotovo"],["ETF a indexy","Hotovo"],["Portfolio, váhy a diverzifikace","Pokračovat"]].map(([title,status],i)=><div className={styles.courseRow} key={title} data-course-row={i<3?"done":"next"}><span className={styles.rowIcon} data-row-icon>{i<3?<CircleCheck size={18} aria-hidden="true"/>:<Play size={18} aria-hidden="true"/>}</span><span>{title}</span><small data-row-status>{status}</small></div>)}
              <p>Portfolio Lab navazuje na základy.</p>
            </div>
          </div>
          <div className={styles.threeSteps} data-steps><span className={styles.stepsLine} data-steps-line aria-hidden="true"/>{[["01","Pochop princip","Jeden pojem. Jasně a bez zbytečného žargonu."],["02","Zkus rozhodnutí","Vybereš odpověď v praktické otázce."],["03","Pochop důsledek","Vysvětlení propojí odpověď s rizikem."]].map(([num,title,description])=><div key={num} data-step><span data-step-num>{num}</span><h3>{title}</h3><p>{description}</p></div>)}</div>
          </div>
        </div>
      </section>
      <section className={styles.lessonSection} aria-labelledby="lesson-title">
        <div className={`${styles.container} ${styles.lessonSectionLayout}`}>
          <div className={styles.lessonSectionCopy}><p className={styles.eyebrow} data-reveal="fade">KRÁTKÉ LEKCE</p><SplitHeading id="lesson-title">Jedna otázka.<br/>O jedno aha víc.</SplitHeading><p data-reveal data-reveal-delay="0.2">Zkusíš odpověď. Dostaneš vysvětlení. A zjistíš nejen co je správně, ale hlavně proč.</p><strong data-reveal data-reveal-delay="0.3">Chyba není konec lekce.</strong><span data-reveal data-reveal-delay="0.4">Je to místo, kde začíná pochopení.</span></div>
          <div className={styles.lessonSectionDemo} data-reveal><LessonPreview compact/></div>
        </div>
      </section>
      <section className={styles.labSection} id="portfolio-lab" aria-labelledby="lab-title">
        <div className={styles.container}>
          <div className={styles.labIntro}><div><p className={styles.eyebrow} data-reveal="fade">PORTFOLIO LAB</p><SplitHeading id="lab-title" mode="lines">Vlastní nápady.<br/>Cvičný kapitál.</SplitHeading></div><div className={styles.labExplanation} data-reveal data-reveal-delay="0.25"><p>Změň rozložení mezi akcie, dluhopisy a hotovost. Zjisti, co jednotlivé části přinášejí. Bez jediného skutečného obchodu.</p><small>Portfolio Lab navazuje na lekce základů.</small></div></div>
          <div data-reveal><PortfolioPreview/></div>
          <div className={styles.labClosing}><p data-reveal>Nejdřív porozumět riziku. Až potom se rozhodovat.</p></div>
        </div>
      </section>
      <section className={styles.progressSection} aria-labelledby="progress-title">
        <div className={styles.container}>
          <p className={styles.eyebrow} data-reveal="fade">TVŮJ POKROK</p><SplitHeading id="progress-title">Rostou znalosti. Ne tlak.</SplitHeading>
          <div className={styles.progressLayout}>
            <div className={styles.progressImage} aria-hidden="true" data-progress-art><Image src="/marketing/v14-steady-understanding.webp" alt="" width={1174} height={654} sizes="(max-width: 780px) calc(100vw - 48px), (max-width: 1100px) 400px, 570px" /></div>
            <div className={styles.progressCard} data-progress-card>
              <span className={styles.cardOverline}>Ukázka pokroku · ilustrační stav</span>
              <div className={styles.progressReward}><strong><CountUp to={60}/> XP</strong><div><p>3 dokončené lekce</p><small>Ukázková odměna za učení.</small></div></div>
              <div className={styles.progressItem} data-progress-item><CircleDashed size={20} aria-hidden="true" data-progress-ring/><div><span>Základy investování</span><small>3 ze 7 lekcí dokončeno</small></div></div>
              <div className={styles.progressItem} data-progress-item data-progress-next><ArrowRight aria-hidden="true" size={20}/><div><span>Další krok: Portfolio, váhy a diverzifikace</span><small>≈ 10 min</small></div></div>
              <div className={styles.progressItem} data-progress-item><LockKeyhole size={20} aria-hidden="true"/><div><span>Portfolio Lab</span><small>Navazuje na lekce základů.</small></div></div>
              <p className={styles.progressPromise}>XP nejsou závod. Jsou malá odměna za pochopení, ne měřítko toho, jak dobře investuješ.</p>
            </div>
          </div>
        </div>
      </section>
      <section className={styles.closing} aria-labelledby="closing-title">
        <div className={styles.container}><Image className={styles.closingArt} data-closing-art src="/marketing/generated-19.webp" alt="" aria-hidden="true" width={1000} height={747} sizes="(max-width: 500px) 300px, (max-width: 780px) 500px, 360px" /><SplitHeading id="closing-title" mode="chars">Zvědavost stačí.<br/>Začni první lekcí.</SplitHeading><p data-reveal data-reveal-delay="0.3">Nemusíš mít všechno nastudované.<br/> Právě od toho je tu investi.</p><div className={styles.closingActions} data-reveal data-reveal-delay="0.4"><Link href="/onboarding" prefetch={false} className={`${styles.primaryButton} ${styles.shimmerHost}`} data-lift data-press {...magneticProps}>Začít se učit <ArrowRight aria-hidden="true" size={18}/><span className={styles.shimmer} data-shimmer aria-hidden="true"/></Link><DemoButton compact className={styles.demoButtonWrap} buttonClassName={styles.secondaryButton}/></div></div>
      </section>
    </main>
    <footer className={styles.footer} data-footer><div className={styles.container}><Link href="/" className={styles.wordmark} aria-label="investi · úvodní stránka">investi!</Link><p>Vzdělávání, ne investiční doporučení.</p><nav aria-label="Patička"><a href="#jak-to-funguje">Jak to funguje</a><Link href="/sign-in" prefetch={false}>Přihlásit se</Link>{legalLinks.map((link) => <Link key={link.href} href={link.href} prefetch={false}>{link.label}</Link>)}</nav></div></footer>
  </MotionRoot>;
}
