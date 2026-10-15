"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { ArrowRight, CircleCheck, CircleX, Menu, RotateCcw } from "lucide-react";
import { LESSON_DEMO_EVENT, PORTFOLIO_DEMO_EVENT, type LessonDemoDetail, type PortfolioDemoDetail, type PortfolioDemoView } from "./motion/events";
import styles from "./pen-landing.module.css";

export function MobileNavigation() {
  const details = useRef<HTMLDetailsElement>(null);
  function close(returnFocus = false) {
    if (!details.current) return;
    details.current.open = false;
    if (returnFocus) details.current.querySelector("summary")?.focus();
  }
  return <div className={styles.mobileActions}>
    <Link href="/sign-in" prefetch={false}>Přihlásit se</Link>
    <details ref={details} className={styles.mobileNav} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); close(true); }
    }}>
      <summary aria-label="Navigační menu"><Menu aria-hidden="true" size={22}/></summary>
      <nav aria-label="Mobilní navigace" onClick={() => close()}>
        <a href="#jak-to-funguje">Jak to funguje</a>
        <a href="#portfolio-lab">Portfolio Lab</a>
        <Link href="/sign-in" prefetch={false}>Přihlásit se</Link>
        <Link href="/onboarding" prefetch={false}>Začít se učit</Link>
      </nav>
    </details>
  </div>;
}

const reasoning = "Když jedna investice klesne, nemusí stejně reagovat všechny ostatní. Diverzifikace ale není záruka proti ztrátě.";

/**
 * Read-only illustration of a lesson step: no lesson engine, auth, storage, or mutations, and nothing to click.
 * On the landing the motion layer plays a scripted answer through LESSON_DEMO_EVENT; without motion it stays on
 * the server-rendered answered state.
 */
export function LessonPreview({ compact = false, hero = false }: { compact?: boolean; hero?: boolean }) {
  const [answer, setAnswer] = useState<"A" | "B" | null>("B");
  const [revealed, setRevealed] = useState(true);
  const [hold, setHold] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Layout effect: the listener must exist before the parent motion layer's layout effect dispatches its first reset.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onDemo = (event: Event) => {
      const detail = (event as CustomEvent<LessonDemoDetail>).detail;
      const apply = () => { setAnswer(detail.answer); setRevealed(detail.revealed); setHold(Boolean(detail.hold)); };
      if (detail.defer) apply(); else flushSync(apply);
    };
    el.addEventListener(LESSON_DEMO_EVENT, onDemo);
    return () => el.removeEventListener(LESSON_DEMO_EVENT, onDemo);
  }, []);
  const correct = answer === "B";
  const feedbackTitle = correct
    ? "Přesně. Rozkládáš závislost, ne rušíš riziko."
    : "Ještě ne. Diverzifikace riziko neruší.";
  const feedback = <><h3 className={correct ? undefined : styles.feedbackWrong}>{feedbackTitle}</h3><p>{reasoning}</p></>;
  return <div ref={rootRef} data-lesson-demo={hero ? "hero" : compact ? "compact" : "base"} className={hero ? styles.heroLessonContent : styles.lessonPreview} role="group" aria-label="Ukázka lekce; nezapisuje pokrok ani neuděluje XP">
    <div className={`${styles.lessonCard} ${compact ? styles.lessonCompact : styles.heroLessonMain}`}>
      <p className={styles.lessonDisclosure}>Ukázka lekce · ilustrační odpověď</p>
      <div className={styles.lessonMeta}><span>Portfolio, váhy a diverzifikace</span><span>≈ 10 min</span></div>
      <p className={styles.lessonTrack}>ZÁKLADY INVESTOVÁNÍ · Lekce 7 ze 7</p>
      {(!compact || !revealed || hold) && <>
        <h3 className={styles.lessonQuestion}>Proč rozdělit peníze mezi více investic?</h3>
        <ul className={styles.answers} aria-label="Ukázkové odpovědi">
          {(["A", "B"] as const).map(key => <li key={key}
            className={`${styles.answer} ${answer === key ? styles.answerSelected : ""} ${answer === key && revealed && key !== "B" ? styles.answerWrong : ""}`}
            data-answer={key} data-selected={answer === key ? "" : undefined}>
            <span>{key}</span><span>{key === "A" ? "Aby jejich hodnota nemohla klesnout." : "Aby výsledek nezávisel na jedné investici."}</span>
            {answer === key && <span className={styles.visuallyHidden}>{revealed ? (key === "B" ? " · vybráno, správně" : " · vybráno, chybně") : " · vybráno"}</span>}
            {answer === key && revealed && (key === "B"
              ? <CircleCheck size={18} aria-hidden="true"/>
              : <CircleX size={18} aria-hidden="true"/>)}
            <i className={styles.answerGlow} data-answer-glow aria-hidden="true"/>
          </li>)}
        </ul>
      </>}
      {revealed && <div className={`${styles.feedback} ${hero ? styles.heroInlineFeedback : ""}`} role="status" data-feedback>{feedback}</div>}
      <div className={styles.lessonBottom}>
        <span className={styles.sampleReward} data-xp>{revealed && correct ? "+20 XP" : "Ukázka bez zápisu"}<span className={styles.visuallyHidden}> · pouze ilustrační, neuděluje skutečné XP</span></span>
        {/* Looks like the lesson's submit button so the scripted cursor has a target; it is not a control. */}
        <span className={styles.lessonSubmit} data-submit data-disabled={answer ? undefined : ""} aria-hidden="true">
          {revealed ? "Pokračovat" : answer ? "Zkontrolovat odpověď" : "Vyber odpověď"}<ArrowRight size={18} aria-hidden="true"/>
        </span>
      </div>
    </div>
    {hero && <aside className={styles.heroLessonAside}>
      <p className={styles.demoEyebrow}>O JEDNO AHA VÍC</p>
      <div className={styles.asideFeedback} role="status" data-aside-feedback>{revealed ? feedback : <><h3>Zkus rozhodnutí.</h3><p>Vyber odpověď a zjisti, proč diverzifikace rozkládá závislost, ale neodstraňuje riziko.</p></>}</div>
      <div className={styles.lessonProgress}><span data-lesson-progress/></div>
      <p className={styles.asideContext}>Pozice v kurzu · lekce 4 z 6<br/>Ukázkový průchod kurzem.</p>
    </aside>}
    {compact && <p className={styles.microDisclaimer}>Ukázka lekce · odpověď a vysvětlení</p>}
    <span className={styles.demoCursor} data-demo-cursor aria-hidden="true"><svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 7.5-6.2 1.9L9 18.5z" fill="#171717" stroke="#fffcf7" strokeWidth="1.5" strokeLinejoin="round"/></svg></span>
  </div>;
}

const initialMix = { stocks: 60, bonds: 30 };
const money = (percent: number) => `${(100 * percent).toLocaleString("cs-CZ")} Kč`;

/** Cash, bonds, stocks around the ring; any unallocated remainder (only mid-animation) shows as empty track. */
function donutFill({ stocks, bonds, cash }: PortfolioDemoView) {
  const a = cash, ab = cash + bonds, abc = cash + bonds + stocks;
  return `conic-gradient(var(--cash) 0 ${a}%, var(--bonds) ${a}% ${ab}%, var(--teal2) ${ab}% ${abc}%, #e4e5dc ${abc}% 100%)`;
}

/** Whole-percent allocation of a fixed sample amount; never a real portfolio. */
export function PortfolioPreview() {
  const [mix, setMix] = useState(initialMix);
  const [saved, setSaved] = useState(false);
  // Display-only values the landing motion layer tweens through (grow-in, 60 → 40 % demo). Never touches `mix`.
  const [view, setView] = useState<PortfolioDemoView | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onDemo = (event: Event) => setView((event as CustomEvent<PortfolioDemoDetail>).detail.view);
    el.addEventListener(PORTFOLIO_DEMO_EVENT, onDemo);
    return () => el.removeEventListener(PORTFOLIO_DEMO_EVENT, onDemo);
  }, []);
  const { stocks, bonds } = mix;
  const cash = 100 - stocks - bonds;
  function allocate(asset: "stocks" | "bonds" | "cash", value: number) {
    const next = Math.max(0, Math.min(100, Math.round(value)));
    setSaved(false);
    setMix(current => asset === "stocks" ? { stocks: next, bonds: Math.min(current.bonds, 100 - next) }
      : asset === "bonds" ? { stocks: Math.min(current.stocks, 100 - next), bonds: next }
      : { stocks: Math.max(0, 100 - next - current.bonds), bonds: Math.min(current.bonds, 100 - next) });
  }
  const shown = view ?? { stocks, bonds, cash };
  const [s, b, c] = [shown.stocks, shown.bonds, shown.cash].map(Math.round);
  const description = s > 50 ? "Většina peněz je v akciích." : c > Math.max(s, b)
    ? "Největší část zůstává v hotovosti." : b > s ? "Největší část je v dluhopisech."
    : "Portfolio má vyrovnanější rozložení.";
  return <div ref={rootRef} className={styles.portfolioPreview} data-portfolio aria-busy={view !== null}>
    <div className={styles.portfolioHeader}><strong>Portfolio Lab</strong><span>Ukázka Portfolio Lab · bez skutečných peněz</span></div>
    <div className={styles.portfolioBody}>
      <div className={styles.allocationControls}>
        <div className={styles.capital}><span>Cvičný kapitál</span><strong>10 000 Kč</strong></div>
        {([
          ["stocks", "Akcie", s, "Podíl ve firmách · větší kolísání"],
          ["bonds", "Dluhopisy", b, "Půjčka emitentovi · také nesou riziko"],
          ["cash", "Hotovost", c, "Peníze po ruce · ztrácí kupní sílu inflací"],
        ] as const).map(([asset, label, percent, context]) => <div className={styles.assetRow} key={asset} data-asset={asset}>
          <div className={styles.assetTop}><label htmlFor={`${asset}-allocation`}>{label}</label><output htmlFor={`${asset}-allocation`}>{percent} %</output></div>
          <input id={`${asset}-allocation`} type="range" min="0" max="100" step="1" value={percent}
            aria-valuetext={`${percent} procent, ${money(percent)}`} onChange={event => allocate(asset, Number(event.target.value))}
            className={styles[`${asset}Range`]} style={{ "--allocation-fill": `linear-gradient(to right, var(--allocation-color) ${percent}%, var(--allocation-track) ${percent}%)` } as CSSProperties}/>
          <div className={styles.assetBottom}><span>{context}</span><span>{money(percent)}</span></div>
        </div>)}
        <div className={styles.allocationTotal} data-total><span>Rozděleno všech 10 000 Kč</span><strong><svg className={styles.totalTick} data-total-tick viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>100 %</strong></div>
        <div className={styles.portfolioActions}>
          <button type="button" className={styles.portfolioSave} data-lift data-press onClick={() => setSaved(true)}>Uložit portfolio</button>
          {(saved || stocks !== 60 || bonds !== 30) && <button type="button" className={styles.resetLink} onClick={() => { setMix(initialMix); setSaved(false); }} aria-label="Vrátit původní mix"><RotateCcw size={17} aria-hidden="true"/></button>}
        </div>
        <p className={styles.savedStatus} role="status" data-saved-status>{saved ? "Mix uložen pouze v této ukázce. Skutečné portfolio se nemění." : ""}</p>
      </div>
      <div className={styles.allocationInsights}>
        <h3>Můj první mix</h3>
        <div className={styles.chartLayout}>
          <div className={styles.donut} data-donut style={{background: donutFill(shown)}}
            role="img" aria-label={`Akcie ${s} procent, dluhopisy ${b} procent, hotovost ${c} procent`}/>
          <div className={styles.legend}><span><i className={styles.legendStocks}/>Akcie {s} %</span><span><i className={styles.legendBonds}/>Dluhopisy {b} %</span><span><i className={styles.legendCash}/>Hotovost {c} %</span></div>
        </div>
        <strong className={styles.allocationInterpretation}>{description}</strong>
        <p>Akcie mají v tomto portfoliu {s >= Math.max(b, c) ? "největší" : "menší"} vliv. Dluhopisy a hotovost mohou průběh zjemnit, ale žádná kombinace nezaručí výnos ani ochranu před ztrátou.</p>
        <p className={styles.portfolioHint} data-portfolio-hint>Zkus snížit akcie na 40 %. Co se změní?</p>
      </div>
    </div>
    <div className={styles.portfolioLegal}>Výukový model používá zjednodušené třídy aktiv. Nejde o investiční doporučení ani odhad budoucího výnosu.</div>
  </div>;
}
