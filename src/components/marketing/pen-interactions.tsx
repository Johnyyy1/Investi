"use client";

import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, Menu, RotateCcw } from "lucide-react";
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
        <Link href="/sign-up" prefetch={false}>Začít se učit</Link>
      </nav>
    </details>
  </div>;
}

const reasoning = "Když jedna investice klesne, nemusí stejně reagovat všechny ostatní. Diverzifikace ale není záruka proti ztrátě.";

/** Independent illustrative state: no lesson engine, auth, storage, or mutations. */
export function LessonPreview({ compact = false, hero = false }: { compact?: boolean; hero?: boolean }) {
  const [answer, setAnswer] = useState<"A" | "B" | null>("B");
  const [revealed, setRevealed] = useState(true);
  const firstAnswer = useRef<HTMLButtonElement>(null);
  const feedbackTitle = answer === "B"
    ? "Přesně. Rozkládáš závislost, ne rušíš riziko."
    : "Ještě ne. Diverzifikace riziko neruší.";
  function retry() {
    setAnswer(null);
    setRevealed(false);
    requestAnimationFrame(() => firstAnswer.current?.focus());
  }
  const feedback = <><h3>{feedbackTitle}</h3><p>{reasoning}</p></>;
  return <div className={hero ? styles.heroLessonContent : styles.lessonPreview} role="group" aria-label="Interaktivní ukázka; nezapisuje pokrok ani neuděluje XP">
    <div className={`${styles.lessonCard} ${compact ? styles.lessonCompact : styles.heroLessonMain}`}>
      <p className={styles.lessonDisclosure}>Ukázka lekce · ilustrační odpověď</p>
      <div className={styles.lessonMeta}><span>Diverzifikace</span><span>≈ 5 min</span></div>
      <p className={styles.lessonTrack}>ZÁKLADY INVESTOVÁNÍ · Lekce 4 z 6</p>
      {(!compact || !revealed) && <>
        <h3 className={styles.lessonQuestion}>Proč rozdělit peníze mezi více investic?</h3>
        <div className={styles.answers} role="group" aria-label="Odpověď na ukázkovou otázku">
          {(["A", "B"] as const).map(key => <button ref={key === "A" ? firstAnswer : undefined} key={key} type="button"
            className={`${styles.answer} ${answer === key ? styles.answerSelected : ""}`}
            aria-pressed={answer === key} onClick={() => { setAnswer(key); setRevealed(false); }}>
            <span>{key}</span><span>{key === "A" ? "Aby jejich hodnota nemohla klesnout." : "Aby výsledek nezávisel na jedné investici."}</span>
            {answer === key && revealed && <CircleCheck size={18} aria-hidden="true"/>}
          </button>)}
        </div>
      </>}
      {revealed && <div className={`${styles.feedback} ${hero ? styles.heroInlineFeedback : ""}`} role="status">{feedback}</div>}
      <div className={styles.lessonBottom}>
        <span className={styles.sampleReward}>{revealed ? "+20 XP" : "Ukázka bez zápisu"}<span className={styles.visuallyHidden}> · pouze ilustrační, neuděluje skutečné XP</span></span>
        <button type="button" className={styles.lessonSubmit} disabled={!answer}
          onClick={revealed ? retry : () => setRevealed(true)}>
          {revealed ? "Pokračovat" : answer ? "Zkontrolovat odpověď" : "Vyber odpověď"}<ArrowRight size={18} aria-hidden="true"/>
        </button>
      </div>
    </div>
    {hero && <aside className={styles.heroLessonAside}>
      <p className={styles.demoEyebrow}>O JEDNO AHA VÍC</p>
      <div className={styles.asideFeedback} role="status">{revealed ? feedback : <><h3>Zkus rozhodnutí.</h3><p>Vyber odpověď a zjisti, proč diverzifikace rozkládá závislost, ale neodstraňuje riziko.</p></>}</div>
      <div className={styles.lessonProgress}><span/></div>
      <p className={styles.asideContext}>Pozice v kurzu · lekce 4 z 6<br/>Ukázkový průchod kurzem.</p>
    </aside>}
    {compact && <p className={styles.microDisclaimer}>Ukázka lekce · odpověď a vysvětlení</p>}
  </div>;
}

const initialMix = { stocks: 60, bonds: 30 };
const money = (percent: number) => `${(100 * percent).toLocaleString("cs-CZ")} Kč`;

/** Whole-percent allocation of a fixed sample amount; never a real portfolio. */
export function PortfolioPreview() {
  const [mix, setMix] = useState(initialMix);
  const [saved, setSaved] = useState(false);
  const { stocks, bonds } = mix;
  const cash = 100 - stocks - bonds;
  function allocate(asset: "stocks" | "bonds" | "cash", value: number) {
    const next = Math.max(0, Math.min(100, Math.round(value)));
    setSaved(false);
    setMix(current => asset === "stocks" ? { stocks: next, bonds: Math.min(current.bonds, 100 - next) }
      : asset === "bonds" ? { stocks: Math.min(current.stocks, 100 - next), bonds: next }
      : { stocks: Math.max(0, 100 - next - current.bonds), bonds: Math.min(current.bonds, 100 - next) });
  }
  const description = stocks > 50 ? "Většina peněz je v akciích." : cash > Math.max(stocks, bonds)
    ? "Největší část zůstává v hotovosti." : bonds > stocks ? "Největší část je v dluhopisech."
    : "Portfolio má vyrovnanější rozložení.";
  return <div className={styles.portfolioPreview}>
    <div className={styles.portfolioHeader}><strong>Portfolio Lab</strong><span>Ukázka Portfolio Lab · bez skutečných peněz</span></div>
    <div className={styles.portfolioBody}>
      <div className={styles.allocationControls}>
        <div className={styles.capital}><span>Cvičný kapitál</span><strong>10 000 Kč</strong></div>
        {([
          ["stocks", "Akcie", stocks, "Podíl ve firmách · větší kolísání"],
          ["bonds", "Dluhopisy", bonds, "Půjčka emitentovi · také nesou riziko"],
          ["cash", "Hotovost", cash, "Peníze po ruce · ztrácí hodnotu inflací"],
        ] as const).map(([asset, label, percent, context]) => <div className={styles.assetRow} key={asset}>
          <div className={styles.assetTop}><label htmlFor={`${asset}-allocation`}>{label}</label><output htmlFor={`${asset}-allocation`}>{percent} %</output></div>
          <input id={`${asset}-allocation`} type="range" min="0" max="100" step="1" value={percent}
            aria-valuetext={`${percent} procent, ${money(percent)}`} onChange={event => allocate(asset, Number(event.target.value))}
            className={styles[`${asset}Range`]} style={{ "--allocation-fill": `linear-gradient(to right, var(--allocation-color) ${percent}%, var(--allocation-track) ${percent}%)` } as CSSProperties}/>
          <div className={styles.assetBottom}><span>{context}</span><span>{money(percent)}</span></div>
        </div>)}
        <div className={styles.allocationTotal}><span>Rozděleno všech 10 000 Kč</span><strong>100 %</strong></div>
        <div className={styles.portfolioActions}>
          <button type="button" className={styles.portfolioSave} onClick={() => setSaved(true)}>Uložit portfolio</button>
          {(saved || stocks !== 60 || bonds !== 30) && <button type="button" className={styles.resetLink} onClick={() => { setMix(initialMix); setSaved(false); }} aria-label="Vrátit původní mix"><RotateCcw size={17} aria-hidden="true"/></button>}
        </div>
        <p className={styles.savedStatus} role="status">{saved ? "Mix uložen pouze v této ukázce. Skutečné portfolio se nemění." : ""}</p>
      </div>
      <div className={styles.allocationInsights}>
        <h3>Můj první mix</h3>
        <div className={styles.chartLayout}>
          <div className={styles.donut} style={{background: `conic-gradient(var(--cash) 0 ${cash}%, var(--bonds) ${cash}% ${cash+bonds}%, var(--teal2) ${cash+bonds}% 100%)`}}
            role="img" aria-label={`Akcie ${stocks} procent, dluhopisy ${bonds} procent, hotovost ${cash} procent`}/>
          <div className={styles.legend}><span><i className={styles.legendStocks}/>Akcie {stocks} %</span><span><i className={styles.legendBonds}/>Dluhopisy {bonds} %</span><span><i className={styles.legendCash}/>Hotovost {cash} %</span></div>
        </div>
        <strong className={styles.allocationInterpretation}>{description}</strong>
        <p>Akcie mají v tomto portfoliu {stocks >= Math.max(bonds, cash) ? "největší" : "menší"} vliv. Dluhopisy a hotovost mohou průběh zjemnit, ale žádná kombinace nezaručí výnos ani ochranu před ztrátou.</p>
        <p className={styles.portfolioHint}>Zkus snížit akcie na 40 %. Co se změní?</p>
      </div>
    </div>
    <div className={styles.portfolioLegal}>Výukový model používá zjednodušené třídy aktiv. Nejde o investiční doporučení ani odhad budoucího výnosu.</div>
  </div>;
}
