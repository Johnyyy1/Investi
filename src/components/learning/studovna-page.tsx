import { GuideImage } from "@/components/guide-image";
import { AppLink as Link } from "@/components/shell/app-link";
import { ArrowRight, ArrowRightCircle, BookOpen, ChevronDown, Circle, CircleCheck, Clock3 } from "lucide-react";
import { getModuleLessons, moduleCatalog } from "@/features/learning/catalog";
import { getStepDefinitions } from "@/features/lessons/returns/guided-flow";
import type { PortfolioView } from "@/features/portfolio/service";
import { formatPracticeCapitalMinor } from "@/features/rewards/presentation";
import { PersonalizationPrompt } from "@/components/personalization/personalization-prompt";
import { reasonLabels, contextLabels, scaffoldLabels } from "@/features/personalization/presentation";
import { ResponsiveDisclosure } from "./responsive-disclosure";
import { StudovnaQuestion } from "./studovna-question";
import { blockDescription, chapterTitle, PLANNED_CHAPTER_TITLE, portfolioComposition, studovnaLesson, type LearnerSummary } from "./studovna-model";
import { legalLinks } from "@/components/legal/legal-links";
import styles from "./studovna-page.module.css";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Chapter = (typeof moduleCatalog)[number];

function ChapterCard({ chapter, index, summary }: { chapter: Chapter; index: number; summary: LearnerSummary }) {
  const lessons = getModuleLessons(chapter.slug).filter((lesson) => lesson.status === "available");
  const finished = lessons.filter((lesson) => summary.completed.some((done) => done.id === lesson.id)).length;
  const focused = summary.next.moduleSlug === chapter.slug && !summary.allComplete;
  const title = chapterTitle(chapter);
  return <ResponsiveDisclosure className={`${styles.chapter} ${focused ? styles.chapterActive : ""}`} initiallyOpen={focused || summary.allComplete}>
    <summary className={styles.chapterHead}>
      <span className={styles.chapterNumber}>{String(index + 1).padStart(2, "0")}</span>
      <span className={styles.chapterName}><h3>{title}</h3><span>{lessons.length} lekcí · ≈ {lessons.reduce((minutes, lesson) => minutes + lesson.estimatedMinutes, 0)} min<span className={styles.mobileCounter}> · {finished} / {lessons.length}</span></span></span>
      <span className={styles.chapterCounter}>{finished} / {lessons.length}</span>
      <ChevronDown size={20} className={styles.chapterToggle} aria-hidden="true" />
    </summary>
    <div className={styles.chapterProgressRow}><div className={styles.chapterProgress} role="meter" aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={finished} aria-label={`Dokončené lekce kapitoly ${title}`}><span style={{ width: `${finished / lessons.length * 100}%` }} /></div><span>{finished} / {lessons.length}</span></div>
    <ol className={styles.lessonList} aria-label={`Lekce kapitoly ${title}`}>
      {lessons.map((lesson) => {
        const row = summary.states.find((state) => state.lessonId === lesson.id);
        const done = row?.status === "completed";
        const active = row?.status === "in_progress";
        const next = !summary.allComplete && summary.next.id === lesson.id && !active;
        const stepCount = getStepDefinitions(lesson.id).length;
        const position = Math.min((row?.lastPosition ?? 0) + 1, stepCount);
        const Marker = done ? CircleCheck : active || next ? ArrowRightCircle : Circle;
        return <li key={lesson.id}><Link className={`${styles.lessonRow} ${next ? styles.lessonCurrent : ""}`} href={`/learn/${lesson.moduleSlug}/${lesson.slug}`} aria-current={active || next ? "step" : undefined}>
          <Marker size={20} className={done || active || next ? styles.lessonActiveMarker : styles.lessonMarker} aria-hidden="true" />
          <span className={styles.lessonText}>{lesson.title}<small>≈ {lesson.estimatedMinutes} min</small></span>
          <span className={styles.lessonDuration}>≈ {lesson.estimatedMinutes} min</span>
          <span className={`${styles.lessonState} ${active || next ? styles.lessonActiveState : ""}`}>
            {done ? "Hotovo" : active ? <><span className={styles.desktopState}>Krok {position} z {stepCount}</span><span className={styles.mobileState}>{position} / {stepCount}</span></> : next ? "Následuje" : <span className="sr-only">Nezačato</span>}
          </span>
        </Link></li>;
      })}
    </ol>
  </ResponsiveDisclosure>;
}

function PortfolioCard({ summary, portfolio }: { summary: LearnerSummary; portfolio: PortfolioView | null | undefined }) {
  const composition = portfolio && portfolioComposition(portfolio);
  let offset = 0;
  const segments = composition?.map(({ color, percent }) => { const start = offset; offset += percent; return `${color} ${start}% ${offset}%`; });
  return <section className={styles.sideCard} aria-labelledby="portfolio-title">
    <p className={styles.eyebrow}>Portfolio Lab</p><h3 id="portfolio-title">Můj první mix</h3><p className={styles.sideDescription}>Cvičný kapitál, skutečné souvislosti.</p>
    <div className={styles.capitalRow}><span>Cvičný kapitál</span><strong>{formatPracticeCapitalMinor(summary.practiceCapital.earnedPracticeCapitalMinor)}</strong></div>
    {composition ? <>
      <div className={styles.composition}><div className={styles.donut} style={{ background: `conic-gradient(${segments!.join(", ")})` }} role="img" aria-label={`Složení portfolia: ${composition.map((item) => `${item.label} ${item.percent} %`).join(", ")}`} /><ul>{composition.map(({ id, label, color, percent }) => <li key={id}><span className={styles.swatch} style={{ background: color }} aria-hidden="true" /><span>{label}</span><strong>{percent.toLocaleString("cs-CZ")} %</strong></li>)}</ul></div>
      <p className={styles.dataLabel}>{portfolio?.marketDataMode === "sample" ? "Ukázková tržní data" : "Složení podle dostupných kotací"}</p>
    </> : <p className={styles.portfolioEmpty}>{portfolio === undefined ? "Portfolio se teď nenačetlo. Zkus ho otevřít znovu." : portfolio === null ? "Dokonči Základy investování a odemkni své cvičné portfolio." : !portfolio.valuationComplete ? "Některé ceny nejsou dostupné. Složení ukážeme, až bude ocenění úplné." : "Tvůj první mix začíná prvním nákupem. Vyzkoušej si ho v Labu."}</p>}
    <Link className={styles.sideLink} href="/lab/portfolio">{portfolio === null ? "Jak odemknout Portfolio Lab" : "Otevřít Portfolio Lab"}<ArrowRight size={16} aria-hidden="true" /></Link>
  </section>;
}

export function StudovnaPage({ summary, portfolio }: { summary: LearnerSummary; portfolio: PortfolioView | null | undefined }) {
  const firstName = summary.user?.name?.trim().split(/\s+/)[0] || "studente";
  const current = summary.state?.status === "in_progress";
  const complete = summary.allComplete;
  const { lesson, step, question, recap } = studovnaLesson(summary);
  const target = `/learn/${summary.next.moduleSlug}/${summary.next.slug}`;
  const learningModule = moduleCatalog.find((item) => item.slug === lesson.moduleSlug)!;
  const moduleLessons = getModuleLessons(learningModule.slug).filter((item) => item.status === "available");
  const lessonIndex = moduleLessons.findIndex((item) => item.id === lesson.id) + 1;
  const minutes = Math.max(1, Math.ceil(lesson.estimatedMinutes * (summary.stepCount - summary.position) / summary.stepCount));
  const description = step.blocks.map(blockDescription).find(Boolean) ?? summary.next.summary;
  const chapters = moduleCatalog.filter((chapter) => chapter.status === "available");
  const planned = moduleCatalog.filter((chapter) => chapter.status === "planned");
  const recommendationReason = reasonLabels[summary.recommendation.reasonCode];
  const recommendedLesson = summary.lessons.find((item) => item.id === summary.recommendation.nextLessonId && item.id !== summary.next.id);
  return <main className={styles.page} data-investi-studovna>
    <div className={styles.container}>
      <div className={styles.hero}>
        <header className={styles.greeting}><h1>{complete ? "To je všechno. Zatím." : current || summary.completed.length > 0 ? `Vítej zpátky, ${firstName}.` : `Vítej v investi, ${firstName}.`}</h1><p>{complete ? "Všechny dostupné lekce máš hotové. Kdykoli se můžeš vrátit." : current ? `Jedna rozdělaná lekce, asi ${minutes} minut. Žádný spěch.` : "Jeden malý krok za druhým. Žádný spěch."}</p></header>
        <div className={styles.guideWrap}><p className={styles.bubble}>{complete ? "Tohle už umíš. Co takhle si to vyzkoušet v Labu?" : current ? `Navážeme tam, kde jsi skončil: ${step.title.toLocaleLowerCase("cs-CZ")}.` : "Nemusíš znát odpovědi předem. Půjdeme společně."}</p><GuideImage className={styles.guide} pose={complete ? "07-small-joy" : current ? "08-leaning" : "01-welcome"} alt="" sizes="(max-width: 767px) 174px, 266px" preload /></div>
        <section className={styles.continueCard} aria-label="Doporučeno pro tebe">
          <div className={styles.continueContent}>
            <div className={styles.lessonContext}><div className={styles.contextRow}><p className={styles.eyebrow}>{complete ? "Všechno hotovo" : current ? "Pokračuj" : "Začni tady"}</p><Link href={`/learn/${learningModule.slug}`} className={styles.contextMeta}>{learningModule.title} · Lekce {lessonIndex} ze {moduleLessons.length}</Link></div><h2>{complete ? "Kurikulum máš za sebou." : lesson.title}</h2>{!complete && <div className={styles.lessonProgress}><div role="progressbar" aria-label="Postup rozpracovanou lekcí" aria-valuenow={summary.position} aria-valuemin={0} aria-valuemax={summary.stepCount}><span style={{ width: `${summary.position / summary.stepCount * 100}%` }} /></div><p>Krok {summary.position + 1} z {summary.stepCount} · zbývá ≈ {minutes} min</p></div>}</div>
            {complete ? <div className={styles.stepPreview}><h3>Teď můžeš zkoušet vlastní nápady.</h3><p>Vrať se k libovolné lekci nebo prozkoumej, jak se tvoje znalosti propojují v Labu.</p></div> : !question && <section className={styles.stepPreview}><p className={styles.questionLabel}>Krok {summary.position + 1}</p><h3>{step.title}</h3><p>{description}</p></section>}
            {complete ? <div className={styles.continueControls}><p className={styles.quietNote}>Všechny lekce zůstávají otevřené.</p><Link href="/lab" className={cn(buttonVariants(), styles.primaryAction)}>Vyzkoušet v Labu<ArrowRight size={18} /></Link></div> : <StudovnaQuestion key={`${lesson.id}-${summary.position}`} question={question} lessonId={lesson.id} position={summary.position} href={target} actionLabel={current ? `Pokračovat od kroku ${summary.position + 1}` : "Začít lekci"} />}
          </div>
          <aside className={styles.recap} aria-label="Souvislosti lekce"><ResponsiveDisclosure><summary><BookOpen size={16} aria-hidden="true" /><span>{recap.length ? "Co už víš" : "Co tě čeká"}</span><ChevronDown size={16} aria-hidden="true" /></summary><div className={styles.recapContent}><p className={styles.eyebrow}>{recap.length ? `Co už víš z kroků 1–${summary.position}` : "Co tě čeká v lekci"}</p>{(recap.length ? recap : [{ title: learningModule.title, body: summary.next.summary }]).map((item, index) => <div className={styles.recapTerm} key={index}><h3>{item.title}</h3><p>{item.body}</p></div>)}<div className={styles.recapNext}><strong>{complete ? "Kdykoli se můžeš vrátit" : `Krok ${summary.position + 1}: ${step.title}`}</strong><p>{complete ? "Opakování upevní znalosti. Uložený pokrok zůstává zachovaný." : summary.next.summary}</p></div></div></ResponsiveDisclosure></aside>
        </section>
      </div>
      <div className={styles.columns}>
        <section className={styles.curriculum} id="curriculum" aria-labelledby="curriculum-title"><div className={styles.curriculumHeading}><p className={styles.eyebrow}>Kurikulum</p><h2 id="curriculum-title">Všechny lekce jsou otevřené.</h2><p>Doporučujeme pořadí shora dolů, ale začít můžeš kdekoli.</p></div><div className={styles.chapterList} data-testid="journey-modules">{chapters.map((chapter, index) => <ChapterCard key={chapter.slug} chapter={chapter} index={index} summary={summary} />)}{planned.length > 0 && <section className={styles.plannedChapter} aria-label={`${PLANNED_CHAPTER_TITLE} – připravujeme`}><span className={styles.chapterNumber}>{String(chapters.length + 1).padStart(2, "0")}</span><div><h3>{PLANNED_CHAPTER_TITLE}</h3><p>{planned.map((chapter) => chapter.title).join(" · ")}</p></div><span className={styles.plannedState}><Clock3 size={16} aria-hidden="true" />Připravujeme</span></section>}</div></section>
        <aside className={styles.side} aria-label="Lab a studijní pokrok"><PortfolioCard summary={summary} portfolio={portfolio} /><Link href="/lab/backtesting" className={styles.backtesting}><Clock3 size={15} aria-hidden="true" />Otevřít Backtesting Lab<ArrowRight size={15} aria-hidden="true" /></Link><section className={styles.sideCard}><p className={styles.eyebrow}>Tvůj pokrok</p><div className={styles.progressValue}><strong>{summary.percentage} %</strong><span>{summary.completed.length} z {summary.lessons.length} lekcí<small>dokončeno</small></span></div><p className={styles.progressNote}>Učení není závod. K hotovým lekcím se můžeš vracet vlastním tempem.</p><Link href="/progress" className={styles.sideLink}>Zobrazit pokrok<ArrowRight size={16} aria-hidden="true" /></Link></section></aside>
      </div>
      <section className={styles.planContext} aria-label="Tvůj studijní plán"><p>{recommendationReason}</p>{recommendedLesson && <Link className={styles.recommendedLink} href={`/learn/${recommendedLesson.moduleSlug}/${recommendedLesson.slug}`}>Doporučená lekce: {recommendedLesson.title}<ArrowRight size={16} aria-hidden="true" /></Link>}<details><summary>Jak si rozvrhnout učení</summary><p>{contextLabels[summary.recommendation.exampleContext]}</p><p>{scaffoldLabels[summary.recommendation.scaffoldLevel]}</p>{summary.recommendation.splitLessonAcrossSessions && <p>Lekci si můžeš rozdělit do více sezení. Uložený postup tě dovede zpět.</p>}</details></section>
      {!summary.profile?.personalizedOnboardingCompletedAt && summary.user && <PersonalizationPrompt userId={summary.user.id} />}
      <footer className={styles.footer}><Link href="/learn" className={styles.wordmark} aria-label="investi · Učení">investi!</Link><p>Vzdělávání, ne investiční doporučení.</p><div><Link href="/">Jak to funguje</Link><Link href="/settings">Nastavení</Link>{legalLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div></footer>
    </div>
  </main>;
}
