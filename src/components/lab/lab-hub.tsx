import Image from "next/image";
import { Suspense } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleAlert, CircleCheck, History, Info, Minus, Moon, TriangleAlert, type LucideIcon } from "lucide-react";
import { AppLink as Link } from "@/components/shell/app-link";
import type { PortfolioView } from "@/features/portfolio/service";
import { backtestPreview, labLessonRows, nextFoundationsLesson } from "./lab-hub-model";
import { dataStatus, fxRate, groups, groupSummaries, minor, percent, signedMoney, trend, wholeMoney, type DataStatus } from "./portfolio/lab-model";
import styles from "./lab-hub.module.css";

/** /lab hub from Pen "Investi / Lab hub — 1440px" (iByrw) and "— 390px" (YZnok), states 1–4.
 * The portfolio needs live quotes, so its card and the guide stream in; everything else renders at once. */

export type LabHubUnlock = { unlocked: boolean; completedPrerequisiteLessons: number; requiredPrerequisiteLessons: number };
type ViewPromise = Promise<PortfolioView | null>;

const TIME_ZONE = "Europe/Prague";
const dateTime = (value: string) => new Intl.DateTimeFormat("cs-CZ", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
const shortDate = (value: string) => new Intl.DateTimeFormat("cs-CZ", { timeZone: TIME_ZONE, day: "numeric", month: "numeric" }).format(new Date(value));
const positions = (count: number) => `${count} ${count >= 1 && count <= 4 ? "pozice" : "pozic"}`;

export function LabHub({ unlock, completedLessonIds, view }: { unlock: LabHubUnlock; completedLessonIds: ReadonlySet<string>; view: ViewPromise | null }) {
  const lessons = labLessonRows(completedLessonIds);
  return <main className={styles.page} data-lab-hub data-locked={!unlock.unlocked}>
    <section className={styles.hero} aria-labelledby="lab-heading">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Lab</p>
        <h1 id="lab-heading">Co se stane, <br className={styles.desktopBreak} />když…</h1>
        <p>Něco změň. Sleduj dopad. Pochop proč.</p>
      </div>
      {view ? <Suspense fallback={<Guide pose="hourglass">Tady se nic nerozbije. Něco změň a uvidíš, co se stane.</Guide>}><LoadedGuide view={view} /></Suspense>
        : <Guide pose="hourglass">Backtesting můžeš zkusit hned. Portfolio Lab navazuje na Základy.</Guide>}
    </section>

    <div className={styles.cards}>
      {view ? <Suspense fallback={<PortfolioSkeleton />}><LoadedPortfolioCard view={view} /></Suspense> : <LockedPortfolioCard unlock={unlock} completedLessonIds={completedLessonIds} />}
      <BacktestingCard />
    </div>

    <section className={styles.lessons} aria-labelledby="lab-lessons-heading">
      <h2 id="lab-lessons-heading">Navazuje na lekce</h2>
      <p>Lab funguje i bez nich. Lekce jen vysvětlí, co v něm uvidíš.</p>
      <ul>{lessons.map((lesson) => <li key={lesson.href}>
        <Link href={lesson.href} className={styles.lessonRow}>
          <span className={styles.lessonAction}>{lesson.action}</span>
          <span className={styles.lessonLesson}>
            <ArrowRight size={16} aria-hidden="true" className={styles.leadsTo} />
            <span><span className={styles.lessonTitle}>{lesson.title}</span><span className={styles.lessonMeta}><span className={styles.chapter}>Kapitola 01 · </span>lekce {lesson.number} · ≈ {lesson.minutes} min</span></span>
          </span>
          {lesson.done ? <span className={styles.done}><CircleCheck size={16} aria-hidden="true" />Hotovo</span> : <span className={styles.recommended}>Doporučujeme nejdřív<ArrowRight size={16} aria-hidden="true" /></span>}
        </Link>
      </li>)}</ul>
    </section>

    <footer className={styles.footer}>
      <p className={styles.footerLogo}>investi!</p>
      <p>Výukový model. Nejde o investiční doporučení ani odhad budoucího výnosu.</p>
      <Link href="/settings">Nastavení</Link>
    </footer>
  </main>;
}

function Guide({ pose, children }: { pose: "hourglass" | "searching"; children: React.ReactNode }) {
  const image = pose === "hourglass" ? { src: "/investi-assets/guide/21-hourglass.webp", width: 749, height: 562 } : { src: "/investi-assets/guide/20-searching-box.webp", width: 872, height: 654 };
  return <div className={styles.guideStage} data-pose={pose}>
    <p className={styles.bubble}>{children}</p>
    <Image className={styles.guide} {...image} alt="" sizes="(min-width: 1024px) 406px, 266px" priority />
  </div>;
}

async function LoadedGuide({ view }: { view: ViewPromise }) {
  return <HubGuide view={await view} />;
}

/** The guide's line follows what the Portfolio card is about to say; a failed load reads as missing prices. */
export function HubGuide({ view }: { view: PortfolioView | null }) {
  const status = view ? dataStatus(view) : null;
  if (!view || status?.kind === "stale" || status?.kind === "unavailable") return <Guide pose="searching">Ceny se teď nenačetly. Hádat je nebudeme, ukážu ti poslední známé.</Guide>;
  if (view.holdings.length > 0) return <Guide pose="hourglass">Všechno je tam, kde jsme to nechali: tvůj mix i jeho hodnota.</Guide>;
  return <Guide pose="hourglass">Tady se nic nerozbije. Něco změň a uvidíš, co se stane.</Guide>;
}

function CardHeading({ id, eyebrow, title }: { id?: string; eyebrow: string; title: string }) {
  return <div className={styles.cardHeading}><p className={styles.eyebrow}>{eyebrow}</p><h2 id={id}>{title}</h2></div>;
}

function Action({ href, primary, label, note }: { href: string; primary?: boolean; label: string; note: string }) {
  return <div className={styles.actionRow}>
    <Link href={href} className={primary ? styles.primary : styles.secondary}>{label}<ArrowRight size={18} aria-hidden="true" /></Link>
    <p>{note}</p>
  </div>;
}

/* ── Portfolio Lab card ──────────────────────────────────────────────────── */

const SAMPLE_MIX = [
  { id: "equity", label: groups.equity.label, color: groups.equity.color, basisPoints: 6000 },
  { id: "bond", label: groups.bond.label, color: groups.bond.color, basisPoints: 3000 },
  { id: "cash", label: groups.cash.label, color: groups.cash.color, basisPoints: 1000 },
];

type Segment = { id: string; label: string; color: string; basisPoints: number; amount?: string };

function Donut({ segments, label }: { segments: readonly Segment[]; label: string }) {
  const radius = 42, circumference = 2 * Math.PI * radius;
  const visible = segments.filter((segment) => segment.basisPoints > 0);
  const total = visible.reduce((sum, segment) => sum + segment.basisPoints, 0);
  const lengths = visible.map((segment) => total > 0 ? (segment.basisPoints / total) * circumference : 0);
  return <div className={styles.composition}>
    <svg className={styles.donut} viewBox="0 0 104 104" role="img" aria-label={label}>
      <circle cx="52" cy="52" r={radius} fill="none" stroke="var(--color-track)" strokeWidth="16" />
      <g transform="rotate(-90 52 52)">{visible.map((segment, index) => {
        const length = lengths[index];
        const start = lengths.slice(0, index).reduce((sum, value) => sum + value, 0);
        const gap = visible.length > 1 ? Math.min(2, length / 2) : 0;
        return <circle key={segment.id} cx="52" cy="52" r={radius} fill="none" stroke={segment.color} strokeWidth="16" strokeDasharray={`${Math.max(0, length - gap)} ${circumference}`} strokeDashoffset={-start} />;
      })}</g>
    </svg>
    <ul className={styles.legend}>{segments.map((segment) => <li key={segment.id}>
      <span className={styles.swatch} style={{ background: segment.color }} aria-hidden="true" />
      <span className={styles.legendLabel}>{segment.label}</span>
      {segment.amount ? <span className={styles.legendAmount}>{segment.amount}</span> : null}
      <strong>{percent(segment.basisPoints, { digits: segment.amount ? 1 : 0 })}</strong>
    </li>)}</ul>
  </div>;
}

function PortfolioSkeleton() {
  return <section className={styles.card} aria-busy="true" aria-label="Portfolio Lab se načítá">
    <CardHeading eyebrow="Portfolio Lab" title="Sestav si portfolio z cvičných peněz." />
    <div className={`${styles.preview} ${styles.skeleton}`} role="status">Načítám portfolio…</div>
  </section>;
}

function LockedPortfolioCard({ unlock, completedLessonIds }: { unlock: LabHubUnlock; completedLessonIds: ReadonlySet<string> }) {
  const next = nextFoundationsLesson(completedLessonIds);
  const done = unlock.completedPrerequisiteLessons, total = unlock.requiredPrerequisiteLessons;
  return <section className={styles.card} data-portfolio-state="locked" aria-labelledby="portfolio-card-heading">
    <CardHeading id="portfolio-card-heading" eyebrow="Portfolio Lab" title="Sestav si portfolio z cvičných peněz." />
    <div className={styles.preview}>
      <h3 className={styles.lockTitle}>Otevře se po Základech investování</h3>
      <p className={styles.lockText}>Mix dává smysl, když víš, co jsou akcie, dluhopisy a ETF. Přesně to Základy probírají.</p>
      <div className={styles.progressHead}><span>Základy investování</span><strong>{done} / {total} lekcí Základů</strong></div>
      <div className={styles.segments} role="img" aria-label={`Hotovo ${done} z ${total} lekcí Základů investování`}>
        {Array.from({ length: total }, (_, index) => <span key={index} data-done={index < done} />)}
      </div>
      {next ? <p className={styles.nextLesson}>Další lekce: <strong>{next.title} · ≈ {next.minutes} min</strong></p> : null}
    </div>
    <Action href={next?.href ?? "/learn"} primary label={next ? "Otevřít další lekci" : "Otevřít Učení"} note="Nic se neztratí. Lab na tebe počká." />
  </section>;
}

async function LoadedPortfolioCard({ view }: { view: ViewPromise }) {
  return <PortfolioCard view={await view} />;
}

export function PortfolioCard({ view }: { view: PortfolioView | null }) {
  if (!view) return <section className={styles.card} data-portfolio-state="error" aria-labelledby="portfolio-card-heading">
    <CardHeading id="portfolio-card-heading" eyebrow="Portfolio Lab" title="Portfolio se teď nenačetlo." />
    <div className={styles.notice}><CircleAlert size={18} aria-hidden="true" /><div><strong>Nic se neztratilo.</strong><p>Tvoje cvičné peníze i pozice zůstaly uložené. V Portfolio Labu se načtou znovu.</p></div></div>
    <Action href="/lab/portfolio" primary label="Otevřít Portfolio Lab" note="Jen cvičné peníze. Nic se doopravdy nekupuje." />
  </section>;
  return view.holdings.length === 0 ? <NewPortfolioCard view={view} /> : <SavedPortfolioCard view={view} />;
}

function NewPortfolioCard({ view }: { view: PortfolioView }) {
  const cash = minor(view.availableCashMinor);
  return <section className={styles.card} data-portfolio-state="new" aria-labelledby="portfolio-card-heading">
    <CardHeading id="portfolio-card-heading" eyebrow="Portfolio Lab" title={cash > 0n ? `Sestav si portfolio z ${wholeMoney(cash)} cvičných peněz.` : "Sestav si portfolio z cvičných peněz."} />
    <div className={styles.preview}>
      <div className={styles.previewHead}><strong>Ukázkový mix</strong>{cash > 0n ? <span className={styles.previewCapital}>{wholeMoney(cash)}</span> : null}</div>
      <Donut segments={SAMPLE_MIX} label="Ukázkový mix: akcie 60 %, dluhopisy 30 %, hotovost 10 %" />
      <p className={styles.meta}>Ukázka · ilustrační rozložení, ne doporučení. Vlastní mix si složíš v Labu.</p>
    </div>
    <Action href="/lab/portfolio" primary label="Otevřít Portfolio Lab" note="Jen cvičné peníze. Nic se doopravdy nekupuje." />
  </section>;
}

const changeIcons: Record<ReturnType<typeof trend>, LucideIcon> = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus, unknown: Minus };

function statusLine(view: PortfolioView, status: DataStatus): { icon: LucideIcon; text: string } | null {
  const sample = view.marketDataMode === "sample";
  if (status.kind === "closed") return { icon: Moon, text: `Trh zavřený · zavírací ceny ${status.observedAt ? dateTime(status.observedAt) : "z posledního obchodního dne"}${sample ? " · ukázková data" : ""}` };
  if (status.kind === "stale") return { icon: History, text: `Poslední známá hodnota${status.observedAt ? ` · ${dateTime(status.observedAt)}` : ""}` };
  if (status.kind === "fresh") return { icon: sample ? Info : CircleCheck, text: `${sample ? "Ukázková data · stav k" : "Aktuální ceny ·"} ${status.observedAt ? dateTime(status.observedAt) : "—"}` };
  return null;
}

function fxNote(view: PortfolioView) {
  const holding = view.holdings.find(({ fxRate: rate, quoteCurrency }) => rate && quoteCurrency !== view.baseCurrency);
  if (!holding?.fxRate) return null;
  const source = view.marketDataMode === "sample" || holding.fxProvider === "investi-deterministic" ? "ukázkový kurz" : holding.fxProvider === "cnb" ? "kurz ČNB" : "referenční kurz";
  return `${source} ${fxRate(holding.fxRate)} Kč/${holding.quoteCurrency}${holding.fxReferenceDate ? ` ze ${shortDate(holding.fxReferenceDate)}` : ""}`;
}

function SavedPortfolioCard({ view }: { view: PortfolioView }) {
  const status = dataStatus(view);
  const line = statusLine(view, status);
  const stale = status.kind === "stale";
  const missing = status.kind === "unavailable" ? status : null;
  const change = view.investmentGainLossMinor;
  const direction = trend(change);
  const ChangeIcon = changeIcons[direction];
  const segments: Segment[] = groupSummaries(view).flatMap((row) => row.weightBasisPoints === null || row.valueMinor === null ? [] : [{ id: row.group, label: groups[row.group].label, color: groups[row.group].color, basisPoints: row.weightBasisPoints, amount: wholeMoney(row.valueMinor) }]);
  const meta = [positions(view.holdings.length), fxNote(view), stale ? "nic se nepřepočítává" : null].filter(Boolean).join(" · ");
  return <section className={styles.card} data-portfolio-state={status.kind} data-tone={stale || missing ? "stale" : undefined} aria-labelledby="portfolio-card-heading">
    <CardHeading id="portfolio-card-heading" eyebrow="Portfolio Lab · Uložené portfolio" title="Tvoje portfolio" />
    {stale || missing ? <div className={styles.notice}><TriangleAlert size={18} aria-hidden="true" /><div>
      <strong>{missing ? missing.missing < missing.total ? "Některé ceny chybí." : "Ceny se teď nenačetly." : "Ceny se teď nenačetly."}</strong>
      <p>{missing ? `Oceněno ${missing.total - missing.missing} z ${missing.total} položek. Chybějící cenu nepočítáme jako nulu.` : "Ukazujeme poslední známé hodnoty."}</p>
    </div></div> : null}
    <div className={styles.preview} data-muted={stale || undefined}>
      {line ? <p className={styles.status}><line.icon size={16} aria-hidden="true" />{line.text}</p> : null}
      {view.portfolioTotalMinor !== null && !missing ? <div className={styles.valueRow}>
        <p className={styles.value}>{wholeMoney(view.portfolioTotalMinor)}</p>
        {change !== null ? <p className={styles.change}><ChangeIcon size={14} aria-hidden="true" />{signedMoney(change)} od nákupu{view.investmentGainLossBasisPoints !== null ? ` · ${percent(view.investmentGainLossBasisPoints, { signed: true })}` : ""}</p> : null}
      </div> : null}
      {segments.length > 0 && !missing ? <Donut segments={segments} label={`Současné rozložení: ${segments.map((segment) => `${segment.label} ${percent(segment.basisPoints)}`).join(", ")}`} /> : null}
      <p className={styles.meta}>{meta}</p>
    </div>
    <Action href="/lab/portfolio" primary label="Pokračovat" note={stale || missing ? "Prohlížet můžeš hned. Nakupovat půjde, až se ceny načtou." : "Jen cvičné peníze. Nic se doopravdy nekupuje."} />
  </section>;
}

/* ── Backtesting Lab card ────────────────────────────────────────────────── */

function BacktestingCard() {
  const preview = backtestPreview();
  return <section className={styles.card} aria-labelledby="backtesting-card-heading">
    <CardHeading id="backtesting-card-heading" eyebrow="Backtesting Lab" title="Vrať se v čase a porovnej dva přístupy." />
    <div className={styles.preview}>
      <p className={styles.metaPlain}>Ukázkový pokus · {preview.amount}</p>
      <h3 className={styles.question}>Mix 60 / 30 / 10, nebo jen akcie?</h3>
      <svg className={styles.sparkline} viewBox="0 0 532 72" preserveAspectRatio="none" role="img" aria-label="Náhled dvou cest stejným obdobím 2020–2021 na syntetických datech">
        <line x1="0" x2="532" y1={preview.paths.baseline} y2={preview.paths.baseline} stroke="var(--color-divider)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={preview.paths.benchmark} fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path d={preview.paths.strategy} fill="none" stroke="var(--color-viz-equity)" strokeWidth="2.25" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className={styles.chartLegend}>
        <span><i className={styles.lineA} aria-hidden="true" />A Mix 60 / 30 / 10</span>
        <span><i className={styles.lineB} aria-hidden="true" />B Akcie</span>
        <span className={styles.period}>Vzorek · {preview.period}</span>
      </div>
    </div>
    <p className={styles.dataLabel}><History size={16} aria-hidden="true" />Ukázková data · syntetické měsíční výnosy</p>
    <Action href="/lab/backtesting" label="Nastavit pokus" note="Žádný vítěz, žádné pořadí. Jen dvě cesty stejným obdobím." />
  </section>;
}
