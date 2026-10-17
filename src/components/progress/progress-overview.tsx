import { GuideImage } from "@/components/guide-image";
import { AppLink as Link } from "@/components/shell/app-link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BookOpen, ChevronDown, Circle, CircleCheck, CircleDot, Clock3, Info, Layers, LockKeyhole, Receipt, RotateCcw, Scale } from "lucide-react";
import { ResponsiveDisclosure } from "@/components/learning/responsive-disclosure";
import paper from "@/components/learning/studovna-page.module.css";
import { LESSON_XP } from "@/features/gamification/domain";
import type { PortfolioLedgerSummary } from "@/features/portfolio/ledger-summary";
import type { evaluateUnlock } from "@/features/progression/unlocks";
import { PORTFOLIO_LAB_UNLOCK_ID, progressionUnlocks } from "@/features/progression/unlocks";
import { LESSON_PRACTICE_CAPITAL_MINOR } from "@/features/rewards/practice-capital";
import { formatPracticeCapitalMinor } from "@/features/rewards/presentation";
import { czechPlural, formatCount, formatDate, formatDecimal } from "@/lib/formatters";
import { progressModel, type LessonStatus, type OutcomeIcon, type ProgressSummary } from "./progress-model";
import { legalLinks } from "@/components/legal/legal-links";
import styles from "./progress-overview.module.css";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Summary = ProgressSummary & {
  user?: { name?: string | null } | null;
  gamification?: { totalXp: number; timeZone: string } | null;
  practiceCapital: { earnedPracticeCapitalMinor: bigint };
};
type Unlock = Pick<ReturnType<typeof evaluateUnlock>, "unlocked" | "totalXp" | "xpRequired" | "completedPrerequisiteLessons" | "requiredPrerequisiteLessons">;
type Model = ReturnType<typeof progressModel>;
type Chapter = Model["chapters"][number];

const numberWords = ["nula", "jedna", "dvě", "tři", "čtyři", "pět", "šest", "sedm", "osm", "devět", "deset", "jedenáct", "dvanáct"];
const spoken = (count: number) => numberWords[count] ?? formatDecimal(count);
const capitalized = (text: string) => text.charAt(0).toLocaleUpperCase("cs-CZ") + text.slice(1);
/** "z" or "ze" before a numeral, following its spoken Czech form (ze tří, ze šesti, z dvanácti). */
const from = (count: number) => [3, 4, 6, 7, 13, 14, 16, 17].includes(count) ? "ze" : "z";
const lessonCount = (count: number) => formatCount(count, ["lekce", "lekce", "lekcí"]);
const lessonGenitive = (count: number) => `${formatDecimal(count)} ${count === 1 ? "lekce" : "lekcí"}`;
const outcomeIcons: Record<OutcomeIcon, LucideIcon> = { layers: Layers, receipt: Receipt, scale: Scale };
const markers: Record<LessonStatus, LucideIcon> = { done: CircleCheck, active: CircleDot, next: CircleDot, todo: Circle };
const chips = { done: { label: "Hotovo", icon: CircleCheck }, started: { label: "Rozpracováno", icon: CircleDot }, todo: { label: "Nezačato", icon: Circle } } as const;

function doneSummary(done: number, active: number) {
  const finished = `${capitalized(spoken(done))} ${done === 1 ? "lekce hotová" : done <= 4 ? "lekce hotové" : "hotových lekcí"}`;
  const started = active ? `, ${spoken(active)} ${czechPlural(active, ["rozdělaná", "rozdělané", "rozdělaných"])}` : "";
  return `${finished}${started}. Rostou znalosti, ne tlak.`;
}

function Shelf({ lesson, timeZone }: { lesson: Model["knowledge"][number]; timeZone: string }) {
  return <article className={styles.book} aria-labelledby={`lesson-${lesson.id}`}>
    <div className={styles.bookHead}><CircleCheck size={16} aria-hidden="true" /><h3 id={`lesson-${lesson.id}`}>{lesson.title}</h3><p>hotovo{lesson.completedAt && <> <time dateTime={lesson.completedAt.toISOString()}>{formatDate(lesson.completedAt, { timeZone, year: undefined })}</time></>}</p></div>
    {lesson.ideas.length > 0 && <ul className={styles.ideas}>{lesson.ideas.map((idea) => <li key={idea.id}><div><h4>{idea.title}</h4><p>{idea.text}</p></div><span className={styles.stepRef}>krok&nbsp;{idea.step}</span></li>)}</ul>}
    <Link className={styles.review} href={lesson.href}><RotateCcw size={14} aria-hidden="true" />Zopakovat celou lekci · ≈ {lesson.estimatedMinutes} min</Link>
  </article>;
}

function ChapterBlock({ chapter }: { chapter: Chapter }) {
  const chip = chips[chapter.status];
  const ChipIcon = chip.icon;
  return <ResponsiveDisclosure className={`${styles.chapter} ${chapter.current ? styles.chapterCurrent : ""}`} initiallyOpen={chapter.current}>
    <summary className={styles.chapterHead}>
      <span className={styles.chapterNumber}>{chapter.number}</span>
      <span className={styles.chapterName}><h3>{chapter.title}</h3><span>{lessonCount(chapter.lessons.length)} · ≈ {chapter.minutes} min</span></span>
      <span className={styles.chapterStatus}><span className={styles.chip} data-status={chapter.status}><ChipIcon size={13} aria-hidden="true" />{chip.label}</span><span className={styles.chapterCount}>{chapter.completed} / {chapter.lessons.length}<span className={styles.countWord}> hotovo</span></span></span>
      <ChevronDown size={20} className={styles.toggle} aria-hidden="true" />
    </summary>
    <div className={styles.segments} aria-hidden="true">{chapter.lessons.map((lesson) => <span key={lesson.id} data-status={lesson.status} />)}</div>
    <ol className={styles.lessons} aria-label={`Lekce kapitoly ${chapter.title}`}>{chapter.lessons.map((lesson) => {
      const Marker = markers[lesson.status];
      return <li key={lesson.id}><Link className={`${styles.lessonRow} ${lesson.highlighted ? styles.lessonCurrent : ""}`} data-status={lesson.status} href={lesson.href} aria-current={lesson.highlighted ? "step" : undefined}>
        <Marker size={16} aria-hidden="true" />
        <span className={styles.lessonTitle}>{lesson.title}</span>
        <span className={styles.lessonState}>{lesson.status === "active" ? `krok ${lesson.step!.position}\u00a0z\u00a0${lesson.step!.count}` : lesson.status === "next" ? "Následuje" : <span className="sr-only">{lesson.status === "done" ? "Hotovo" : "Nezačato"}</span>}</span>
      </Link></li>;
    })}</ol>
  </ResponsiveDisclosure>;
}

function PortfolioCard({ summary, unlock, portfolio, model, timeZone }: { summary: Summary; unlock: Unlock | null; portfolio: PortfolioLedgerSummary | null | undefined; model: Model; timeZone: string }) {
  const unlocked = Boolean(unlock?.unlocked);
  const earned = summary.practiceCapital.earnedPracticeCapitalMinor;
  const reward = progressionUnlocks[PORTFOLIO_LAB_UNLOCK_ID].rewardPracticeCapitalMinor;
  const last = portfolio?.lastTrade;
  const title = !unlocked ? "Zatím zamčený" : portfolio === undefined ? "Uložené údaje se nenačetly" : !portfolio ? "Cvičné portfolio" : portfolio.holdingsCount ? `${formatCount(portfolio.holdingsCount, ["pozice", "pozice", "pozic"])} v portfoliu` : "Připravené k prvnímu nákupu";
  return <section className={styles.lab} aria-labelledby="lab-title">
    <p className={styles.eyebrow}>Portfolio Lab</p>
    <div className={styles.labHead}><h2 id="lab-title">{title}</h2><p>Cvičný kapitál, nic skutečného.</p></div>
    <dl className={styles.facts}>
      {!unlocked && unlock && <>
        <div><dt>Lekce Základů investování</dt><dd>{unlock.completedPrerequisiteLessons} / {unlock.requiredPrerequisiteLessons}</dd></div>
        <div><dt>XP k odemčení</dt><dd>{formatDecimal(Math.min(unlock.totalXp, unlock.xpRequired))} / {formatDecimal(unlock.xpRequired)} XP</dd></div>
        <div><dt>Po odemčení</dt><dd>{formatPracticeCapitalMinor(reward)}</dd></div>
      </>}
      {unlocked && portfolio && <>
        <div><dt>Otevřeno</dt><dd>{formatDate(portfolio.openedAt, { timeZone })}</dd></div>
        <div><dt>Poslední změna</dt><dd>{formatDate(last?.executedAt ?? portfolio.openedAt, { timeZone })} · {last ? `${last.side === "BUY" ? "nákup" : "prodej"} ${last.symbol}` : "založení"}</dd></div>
      </>}
      {(unlocked || earned > 0n) && portfolio !== undefined && <div><dt>Cvičný kapitál</dt><dd data-testid="total-practice-capital">{formatPracticeCapitalMinor(earned)}</dd></div>}
      {unlocked && portfolio && <div><dt>Volná hotovost</dt><dd>{formatPracticeCapitalMinor(portfolio.availableCashMinor)}</dd></div>}
    </dl>
    {unlocked && portfolio === undefined && <p className={styles.note} role="status"><Info size={15} aria-hidden="true" />Portfolio zůstává uložené. Údaje teď neumíme načíst, proto neukazujeme žádná čísla.</p>}
    {unlocked && portfolio && <p className={styles.note}><Info size={15} aria-hidden="true" />Tady jsou jen uložené údaje. Hodnotu podle aktuálních cen ukazuje Lab.</p>}
    {!unlocked && unlock && <p className={styles.note}><LockKeyhole size={15} aria-hidden="true" />{unlock.completedPrerequisiteLessons < unlock.requiredPrerequisiteLessons ? "Odemkne se po dokončení všech lekcí Základů investování." : "Lekce Základů máš hotové. Chybí ještě XP."} Cvičný kapitál není skutečné peníze.</p>}
    {model.labBridge && <div className={styles.bridge}><p className={styles.bridgeLabel}>Kde to využiješ</p><p>{model.labBridge.text}</p><p className={styles.meta}>Z lekce {model.labBridge.lessonTitle}</p></div>}
    <Link className={styles.textLink} href="/lab/portfolio">{unlocked ? "Otevřít Portfolio Lab" : "Zobrazit podmínky"}<ArrowRight size={15} aria-hidden="true" /></Link>
  </section>;
}

function Milestone({ milestone, next }: { milestone: NonNullable<Model["milestone"]>; next: Summary["next"] }) {
  const { outcome, nextChapter, chapter } = milestone;
  return <section className={styles.milestone} aria-labelledby="milestone-title">
    <div className={styles.opens}>
      <p className={styles.eyebrow}>{outcome ? "Co ti to otevírá" : "Co kapitola probrala"}</p>
      <h2 id="milestone-title">{outcome?.lead ?? chapter.description}</h2>
      <ul className={styles.outcomes}>{outcome ? outcome.items.map((item) => {
        const Icon = outcomeIcons[item.icon];
        return <li key={item.title}><span className={styles.outcomeIcon}><Icon size={18} aria-hidden="true" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></li>;
      }) : chapter.lessons.map((lesson) => <li key={lesson.id}><span className={styles.outcomeIcon}><CircleCheck size={18} aria-hidden="true" /></span><div><h3>{lesson.title}</h3><p>{lesson.summary}</p></div></li>)}</ul>
      {milestone.bridge && <p className={styles.bridgeLine}>{milestone.bridge}</p>}
    </div>
    <div className={styles.nextChapter}>
      <p className={styles.eyebrow}>Další kapitola</p>
      <div className={styles.nextHead}><span className={styles.nextNumber}>{nextChapter.number}</span><div><h3>{nextChapter.title}</h3><p>{lessonCount(nextChapter.lessons.length)} · ≈ {nextChapter.minutes} min</p></div></div>
      <p className={styles.promise}>{nextChapter.description}</p>
      <ol className={styles.nextLessons} aria-label={`Co tě čeká v kapitole ${nextChapter.title}`}>{nextChapter.lessons.map((lesson, index) => <li key={lesson.id} className={lesson.highlighted ? styles.nextLesson : undefined}>{lesson.status === "done" ? <CircleCheck size={14} aria-hidden="true" /> : <span aria-hidden="true">{index + 1}</span>}{lesson.title}{lesson.status === "done" && <span className="sr-only"> (hotovo)</span>}</li>)}</ol>
      <Link className={cn(buttonVariants(), paper.primaryAction, styles.primary)} href={`/learn/${next.moduleSlug}/${next.slug}`}>Začít lekcí {next.title}<ArrowRight size={18} aria-hidden="true" /></Link>
      <p className={styles.pause}>Nebo si dej pauzu. Pokrok je uložený.</p>
    </div>
  </section>;
}

export function ProgressOverview({ summary, unlock, portfolio }: { summary: Summary; unlock: Unlock | null; portfolio: PortfolioLedgerSummary | null | undefined }) {
  const model = progressModel(summary);
  const { milestone, current } = model;
  const complete = summary.allComplete;
  const empty = summary.completed.length === 0;
  const timeZone = summary.gamification?.timeZone ?? "UTC";
  const totalXp = unlock?.totalXp ?? summary.gamification?.totalXp ?? 0;
  const firstName = summary.user?.name?.trim().split(/\s+/)[0];
  const step = `${summary.position + 1}\u00a0z\u00a0${summary.stepCount}`;
  const definition = progressionUnlocks[PORTFOLIO_LAB_UNLOCK_ID];
  const guide = empty ? undefined : milestone
    ? { pose: "07-small-joy" as const, line: "Celá kapitola je uložená. Tohle už ti zůstane." }
    : { pose: "18-bookshelf" as const, line: complete ? "Police je plná všeho, co zatím máme. Další knihy chystáme." : "Každá hotová lekce je kniha v polici. Kdykoli si ji můžeš otevřít znovu." };
  const title = milestone ? `${milestone.chapter.title} máš za sebou.` : complete ? "Všechno, co zatím je, máš za sebou." : empty ? "Tvoje police je zatím prázdná." : firstName ? `Co už umíš, ${firstName}.` : "Co už umíš.";
  const subtitle = milestone ? undefined : complete ? `Všech ${summary.lessons.length} lekcí je hotových. Další kapitolu připravujeme.` : empty ? current ? "Jednu lekci máš rozdělanou. Uložený krok na tebe počká." : "První kniha přibude s první hotovou lekcí. Žádný spěch." : doneSummary(summary.completed.length, model.activeCount);
  const footnote = milestone || empty ? undefined : complete
    ? { icon: CircleCheck, text: `Všechny dostupné lekce máš hotové. Kapitola ${model.planned?.title ?? "další"} se připravuje.`, label: "Prozkoumat Lab" }
    : current ? { icon: CircleDot, text: `Myšlenky z lekce ${summary.next.title} přibudou, až ji dokončíš. Teď jsi na kroku ${step}.`, label: `Pokračovat od kroku ${summary.position + 1}` }
    : { icon: Circle, text: `Další na řadě: ${summary.next.title} · ≈ ${summary.next.estimatedMinutes} min.`, label: "Začít lekci" };
  const FootnoteIcon = footnote?.icon;

  return <main className={styles.page} data-investi-progress data-state={milestone ? "milestone" : complete ? "complete" : empty ? "empty" : "partial"}>
    <div className={styles.container}>
      <header className={`${styles.hero} ${milestone ? styles.heroMilestone : ""} ${guide ? "" : styles.heroPlain}`}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>{milestone ? `Kapitola ${milestone.chapter.number} hotová` : "Pokrok"}</p>
          <h1>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {milestone && <p className={styles.milestoneMeta}>{lessonCount(milestone.chapter.lessons.length)}{milestone.completedAt && <> · dokončeno <time dateTime={milestone.completedAt.toISOString()}>{formatDate(milestone.completedAt, { timeZone, weekday: "short" })}</time></>}</p>}
          <p className={styles.stats}><span data-testid="available-progress">{summary.completed.length} {from(summary.lessons.length)} {lessonGenitive(summary.lessons.length)}</span><span aria-hidden="true">·</span><span data-testid="total-xp">{formatDecimal(totalXp)} XP</span><span className={styles.statsNote}>XP nejsou závod. Jsou malá odměna za pochopení.</span></p>
        </div>
        {guide && <div className={styles.guideWrap}><div className={styles.bubble}><p>{guide.line}</p></div><GuideImage className={styles.guide} pose={guide.pose} sizes={milestone ? "(max-width: 767px) 180px, 280px" : "(max-width: 767px) 270px, (max-width: 1199px) 380px, 566px"} alt="" preload /></div>}
      </header>

      {milestone && <Milestone milestone={milestone} next={summary.next} />}

      <section className={styles.knowledge} aria-labelledby="knowledge-title">
        <div className={styles.sectionHead}>
          <div><h2 id="knowledge-title">Co už umíš</h2><p>Hlavní myšlenky z hotových lekcí a krok, ve kterém se probírají.</p></div>
          {!empty && <p className={styles.count}>{formatCount(model.ideaCount, ["myšlenka", "myšlenky", "myšlenek"])} {from(model.knowledge.length)} {lessonGenitive(model.knowledge.length)}</p>}
        </div>
        {empty ? <div className={styles.emptyShelf}>
          <span className={styles.emptyIcon}><BookOpen size={18} aria-hidden="true" /></span>
          <div>
            <h3>{current ? "První lekci máš rozdělanou." : "Zatím tu nejsou žádné myšlenky."}</h3>
            <p>Objeví se tu, až dokončíš první lekci. Rozpracovaná lekce se nepočítá napůl.</p>
            <Link className={cn(buttonVariants(), paper.primaryAction, styles.primary)} href={model.continueHref}>{current ? `Pokračovat od kroku ${summary.position + 1}` : "Začít první lekci"}<ArrowRight size={18} aria-hidden="true" /></Link>
            <p className={styles.meta}>{summary.next.title} · ≈ {summary.next.estimatedMinutes} min{current ? ` · krok ${step}` : ""}</p>
          </div>
        </div> : <>
          <div className={styles.books}>
            {model.featured.map((lesson) => <Shelf key={lesson.id} lesson={lesson} timeZone={timeZone} />)}
            {model.featured.length < 3 && !complete && <div className={styles.slot}><p>Další kniha přibude s lekcí {summary.next.title}.</p></div>}
          </div>
          {model.shelved.length > 0 && <details className={styles.more}><summary>Další hotové lekce ({model.shelved.length})<ChevronDown size={18} aria-hidden="true" /></summary><div className={styles.books}>{model.shelved.map((lesson) => <Shelf key={lesson.id} lesson={lesson} timeZone={timeZone} />)}</div></details>}
        </>}
        {footnote && FootnoteIcon && <div className={styles.footnote}><FootnoteIcon size={16} aria-hidden="true" /><p>{footnote.text}</p><Link className={styles.textLink} href={model.continueHref}>{footnote.label}<ArrowRight size={15} aria-hidden="true" /></Link></div>}
      </section>

      <div className={styles.lower}>
        <section className={styles.curriculum} aria-labelledby="curriculum-title">
          <div className={styles.curriculumHead}><h2 id="curriculum-title">Kurikulum podle kapitol</h2><Link className={styles.textLink} href="/learn#curriculum">Otevřít Učení<ArrowRight size={15} aria-hidden="true" /></Link></div>
          {model.chapters.map((chapter) => <ChapterBlock key={chapter.slug} chapter={chapter} />)}
          {model.planned && <div className={styles.planned}><span className={styles.chapterNumber}>{model.planned.number}</span><span className={styles.chapterName}><h3>{model.planned.title}</h3><span>{model.planned.topics.join(" · ")}</span></span><span className={styles.chapterStatus}><span className={styles.chip} data-status="planned"><Clock3 size={13} aria-hidden="true" />Připravujeme</span></span></div>}
          <ul className={styles.legend} aria-label="Stavy lekcí"><li data-status="done">hotovo</li><li data-status="active">rozpracováno</li><li data-status="todo">nezačato</li></ul>
        </section>
        <PortfolioCard summary={summary} unlock={unlock} portfolio={portfolio} model={model} timeZone={timeZone} />
      </div>

      <details className={styles.explanation}><summary>Jak funguje pokrok<ChevronDown size={18} aria-hidden="true" /></summary><p>První dokončení lekce přidá {LESSON_XP} XP. XP měří učení a nedají se utratit. Portfolio Lab se odemkne po dokončení všech {definition.prerequisiteLessonIds.length} lekcí Základů investování a získání {formatDecimal(definition.xpRequired)} XP. Odemčení jednorázově přidá {formatPracticeCapitalMinor(definition.rewardPracticeCapitalMinor)} cvičného kapitálu. Každé první dokončení lekce mimo Základy přidá {formatPracticeCapitalMinor(LESSON_PRACTICE_CAPITAL_MINOR)}; když ji dokončíš dřív, kapitál počká na odemčení. Opakování lekce další XP ani kapitál nepřidává.</p><p>Cvičný kapitál je vzdělávací vklad do Portfolio Labu. Nejsou to skutečné peníze ani investiční výnos.</p></details>

      <footer className={styles.footer}><Link href="/learn" className={styles.wordmark} aria-label="investi · Učení">investi!</Link><p>Vzdělávání, ne investiční doporučení.</p><div><Link href="/">Jak to funguje</Link><Link href="/settings">Nastavení</Link>{legalLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div></footer>
    </div>
  </main>;
}
