import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CircleCheck, CircleDashed, LockKeyhole, Play } from "lucide-react";
import { DemoButton } from "@/components/auth/demo-button";
import { LessonPreview, MobileNavigation, PortfolioPreview } from "./pen-interactions";
import styles from "./pen-landing.module.css";

export function PenLanding() {
  return <div className={styles.landing}>
    <a className={styles.skip} href="#main">Přejít k obsahu</a>
    <header className={styles.siteHeader}>
      <div className={styles.container}>
        <Link href="/" className={styles.wordmark} aria-label="investi domů">investi!</Link>
        <nav className={styles.topNav} aria-label="Hlavní navigace">
          <a href="#jak-to-funguje">Jak to funguje</a>
          <a href="#portfolio-lab">Portfolio Lab</a>
          <Link href="/sign-in" prefetch={false}>Přihlásit se</Link>
        </nav>
        <MobileNavigation />
      </div>
    </header>
    <main id="main" tabIndex={-1}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.container}>
          <h1 id="hero-title">Peníze jsou vážné.<br/><span>Učení nemusí být.</span></h1>
          <div className={styles.heroIntro}>
            <p>Krátké lekce, praktická cvičení a portfolio nanečisto. Objev investování bez skutečných peněz.</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/sign-up" prefetch={false}>Začít se učit <ArrowRight aria-hidden="true" size={19}/></Link>
              <a className={styles.textAction} href="#jak-to-funguje">Jak to funguje</a>
            </div>
          </div>
          <div className={styles.heroLessonWrap} role="group" aria-label="Interaktivní ukázka; nezapisuje pokrok ani neuděluje XP">
            <Image className={styles.heroArt} src="/marketing/v14-curiosity-cropped.png" alt="" aria-hidden="true" width={620} height={628} sizes="(max-width: 500px) 98px, (max-width: 1100px) 194px, 256px" preload />
            <div className={styles.lessonBrowserHeader}><span className={styles.smallWordmark}>investi!</span><span>Základy investování / Diverzifikace</span><span>Lekce 4 z 6 · ≈ 5 min</span><span>Ukázka lekce</span></div>
            <LessonPreview hero />
          </div>
          <p className={styles.microDisclaimer}>Ukázka lekce · odpověď a vysvětlení</p>
        </div>
      </section>
      <section className={styles.journey} id="jak-to-funguje" aria-labelledby="journey-title">
        <div className={styles.container}>
          <p className={styles.eyebrow}>JAK TO FUNGUJE</p>
          <h2 id="journey-title">Malé kroky.<br/>Velké souvislosti.</h2>
          <p className={styles.journeyDescription}>Nejdřív pochopíš jeden pojem. Pak si ho zkusíš. A postupně zjistíš, jak do sebe investování zapadá.</p>
          <div className={styles.journeyContent}>
            <div className={styles.journeyIllustration} aria-hidden="true">
              <Image src="/marketing/v14-discovery-edge.png" alt="" width={685} height={1065} sizes="(max-width: 780px) 250px, (max-width: 1100px) 302px, 397px" />
            </div>
            <div className={styles.courseCard}>
              <Image className={styles.discoveryGripTop} src="/marketing/v14-discovery-top-grip.png" alt="" aria-hidden="true" width={136} height={86} />
              <Image className={styles.discoveryGripSide} src="/marketing/v14-discovery-side-grip.png" alt="" aria-hidden="true" width={97} height={115} />
              <span className={styles.cardOverline}>Ukázka kurzu · ilustrační průchod</span>
              <div className={styles.courseHeader}><h3>Základy investování</h3><span>3 / 6</span></div>
              <div className={styles.courseProgress}><span/></div>
              {[["Co je akcie?","Hotovo"],["Výnos a riziko","Hotovo"],["Investiční horizont","Hotovo"],["Diverzifikace","Pokračovat"]].map(([title,status],i)=><div className={styles.courseRow} key={title}><span className={styles.rowIcon}>{i<3?<CircleCheck size={18} aria-hidden="true"/>:<Play size={18} aria-hidden="true"/>}</span><span>{title}</span><small>{status}</small></div>)}
              <p>Portfolio Lab navazuje na základy.</p>
            </div>
          </div>
          <div className={styles.threeSteps}>{[["01","Pochop princip","Jeden pojem. Jasně a bez zbytečného žargonu."],["02","Zkus rozhodnutí","Vybereš odpověď v praktické otázce."],["03","Pochop důsledek","Vysvětlení propojí odpověď s rizikem."]].map(([num,title,description])=><div key={num}><span>{num}</span><h3>{title}</h3><p>{description}</p></div>)}</div>
        </div>
      </section>
      <section className={styles.lessonSection} aria-labelledby="lesson-title">
        <div className={`${styles.container} ${styles.lessonSectionLayout}`}>
          <div className={styles.lessonSectionCopy}><p className={styles.eyebrow}>KRÁTKÉ LEKCE</p><h2 id="lesson-title">Jedna otázka.<br/>O jedno aha víc.</h2><p>Zkusíš odpověď. Dostaneš vysvětlení. A zjistíš nejen co je správně, ale hlavně proč.</p><strong>Chyba není konec lekce.</strong><span>Je to místo, kde začíná pochopení.</span></div>
          <div className={styles.lessonSectionDemo}><LessonPreview compact/></div>
        </div>
      </section>
      <section className={styles.labSection} id="portfolio-lab" aria-labelledby="lab-title">
        <div className={styles.container}>
          <div className={styles.labIntro}><div><p className={styles.eyebrow}>PORTFOLIO LAB</p><h2 id="lab-title">Vlastní nápady.<br/>Cvičné peníze.</h2></div><div className={styles.labExplanation}><p>Změň rozložení mezi akcie, dluhopisy a hotovost. Zjisti, co jednotlivé části přinášejí. Bez jediného skutečného obchodu.</p><small>Portfolio Lab navazuje na lekce základů.</small></div></div>
          <PortfolioPreview/>
          <div className={styles.labClosing}><p>Nejdřív porozumět riziku. Až potom se rozhodovat.</p></div>
        </div>
      </section>
      <section className={styles.progressSection} aria-labelledby="progress-title">
        <div className={styles.container}>
          <p className={styles.eyebrow}>TVŮJ POKROK</p><h2 id="progress-title">Rostou znalosti. Ne tlak.</h2>
          <div className={styles.progressLayout}>
            <div className={styles.progressImage} aria-hidden="true"><Image src="/marketing/v14-steady-understanding.png" alt="" width={1174} height={654} sizes="(max-width: 780px) calc(100vw - 48px), (max-width: 1100px) 400px, 570px" /></div>
            <div className={styles.progressCard}>
              <span className={styles.cardOverline}>Ukázka pokroku · ilustrační stav</span>
              <div className={styles.progressReward}><strong>60 XP</strong><div><p>3 dokončené lekce</p><small>Ukázková odměna za učení.</small></div></div>
              <div className={styles.progressItem}><CircleDashed size={20} aria-hidden="true"/><div><span>Základy investování</span><small>3 z 6 lekcí dokončeno</small></div></div>
              <div className={styles.progressItem}><ArrowRight aria-hidden="true" size={20}/><div><span>Další krok: Diverzifikace</span><small>≈ 5 minut · +20 XP v ukázce</small></div></div>
              <div className={styles.progressItem}><LockKeyhole size={20} aria-hidden="true"/><div><span>Portfolio Lab</span><small>Navazuje na lekce základů.</small></div></div>
              <p className={styles.progressPromise}>XP nejsou závod. Jsou malá odměna za pochopení, ne měřítko toho, jak dobrý jsi investor.</p>
            </div>
          </div>
        </div>
      </section>
      <section className={styles.closing} aria-labelledby="closing-title">
        <div className={styles.container}><Image className={styles.closingArt} src="/marketing/generated-19.webp" alt="" aria-hidden="true" width={1200} height={896} sizes="(max-width: 500px) 300px, (max-width: 780px) 500px, 360px" /><h2 id="closing-title">Zvědavost stačí.<br/>Začni první lekcí.</h2><p>Nemusíš mít všechno nastudované.<br/> Právě od toho je tu investi.</p><div className={styles.closingActions}><Link href="/sign-up" prefetch={false} className={styles.primaryButton}>Začít se učit <ArrowRight aria-hidden="true" size={18}/></Link><DemoButton compact className={styles.demoButtonWrap} buttonClassName={styles.secondaryButton}/></div></div>
      </section>
    </main>
    <footer className={styles.footer}><div className={styles.container}><Link href="/" className={styles.wordmark}>investi!</Link><p>Vzdělávání, ne investiční doporučení.</p><nav aria-label="Patička"><a href="#jak-to-funguje">Jak to funguje</a><Link href="/sign-in" prefetch={false}>Přihlásit se</Link></nav></div></footer>
  </div>;
}
