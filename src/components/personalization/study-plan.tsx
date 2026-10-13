import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Circle, Flag, Timer, Waypoints } from "lucide-react";
import { availableLessons, getModuleLessons, moduleCatalog } from "@/features/learning/catalog";
import type { LearnerProfile } from "@/features/personalization/profile";
import type { LearningRecommendation } from "@/features/personalization/recommendation";
import { contextLabels, goalLabels, presentRecommendation, scaffoldLabels, sessionLabels } from "@/features/personalization/presentation";
import { OnboardingGuide, OnboardingHeader } from "./onboarding-frame";
import styles from "./personalization-flow.module.css";

export function StudyPlan({ profile, recommendation, states }: {
  profile: LearnerProfile; recommendation: LearningRecommendation; states: readonly { lessonId: string; status: string }[];
}) {
  const view = presentRecommendation(recommendation);
  const completed = new Set(states.filter((state) => state.status === "completed").map((state) => state.lessonId));
  const session = recommendation.sessionLessonIds.flatMap((id) => availableLessons.find((lesson) => lesson.id === id) ?? []);
  const complete = recommendation.reasonCode === "CURRICULUM_COMPLETE";
  const scaffoldTitle = { guided: "Klidně od základů", standard: "Krok za krokem", compact: "Svižné zopakování" }[recommendation.scaffoldLevel];
  return <main className={`investi-theme ${styles.flow}`}>
    <OnboardingHeader progress={1} back="/settings" trailing={<Link className={styles.quiet} href="/learn">Do Studovny</Link>} />
    <div className={`${styles.column} ${styles.planColumn}`}>
      <p className={styles.eyebrow}>Krok 6 z 6 · Plán z tvých odpovědí</p>
      <h1 className={styles.planTitle}>Tvůj plán</h1>
      <p className={styles.planSubtitle}>Předvolby jsou uložené. Učení si můžeš kdykoli přizpůsobit v nastavení.</p>
      <OnboardingGuide pose={complete ? "07-small-joy" : recommendation.scaffoldLevel === "guided" ? "04-calm-book" : "06-map"}>{complete ? "Dostupné lekce už máš za sebou. Můžeš si je zopakovat nebo zkusit Lab." : recommendation.scaffoldLevel === "compact" ? "Na základech se máš o co opřít. Známé pojmy projdi svižněji, úlohy si vyzkoušej." : "Tady je tvůj další krok. Půjdeme v tempu, které ti sedí."}</OnboardingGuide>
      <section className={styles.firstLesson} aria-label="Doporučeno pro tebe">
        <div className={styles.lessonMeta}><p className={styles.eyebrow}>{view.lesson ? "Doporučený začátek" : "Další krok"}</p>{view.lesson && <span>{view.moduleTitle}</span>}</div>
        <h2 className={styles.lessonTitle}>{view.lesson?.title ?? (complete ? "Všechny lekce máš hotové" : "Doporučení není dostupné")}</h2>
        {view.lesson && <p className={styles.lessonDuration}>Přibližně {view.lesson.estimatedMinutes} min · {recommendation.splitLessonAcrossSessions ? "klidně ve více sezeních" : "vlastním tempem"}</p>}
        {view.lesson && <p className={styles.lessonSummary}>{view.lesson.summary}</p>}
        <Link className={styles.primary} href={view.href ?? "/learn#curriculum"}>{view.href ? "Začít doporučenou lekci" : "Zobrazit celé učení"}<ArrowRight size={18} aria-hidden="true" /></Link>
      </section>
      <section className={styles.because} aria-labelledby="plan-reasons">
        <h2 id="plan-reasons" className={styles.eyebrow}>Proč zrovna takhle</h2>
        <ul className={styles.reasonList}>
          <li><Flag size={18} aria-hidden="true" /><div><p className={styles.reasonTitle}>{profile.primaryGoal ? goalLabels[profile.primaryGoal] : "Postupně poznat investování"}</p><p>{contextLabels[recommendation.exampleContext]}</p></div></li>
          <li><Waypoints size={18} aria-hidden="true" /><div><p className={styles.reasonTitle}>{scaffoldTitle}</p><p>{view.reason}</p></div></li>
          <li><Timer size={18} aria-hidden="true" /><div><p className={styles.reasonTitle}>{sessionLabels[profile.preferredSessionMinutes]} na jedno sezení</p><p>{recommendation.splitLessonAcrossSessions ? "Lekci si můžeš rozdělit do více sezení. Uložený postup tě dovede zpět." : "Tempo je orientační. Pauzu si můžeš dát kdykoli."}</p></div></li>
        </ul>
        <details className={styles.sessionDetails}><summary>Jak si rozvrhnout učení <ChevronDown size={16} aria-hidden="true" /></summary><p>{scaffoldLabels[recommendation.scaffoldLevel]}</p>{session.length > 0 && <><p className={styles.sessionLabel}>Doporučené sezení</p><ol className={styles.sessionList}>{session.map((lesson) => <li key={lesson.id}><Link href={`/learn/${lesson.moduleSlug}/${lesson.slug}`}>{lesson.title}</Link><span>≈ {lesson.estimatedMinutes} min</span></li>)}</ol></>}</details>
      </section>
      <section className={styles.curriculum} aria-labelledby="plan-curriculum">
        <h2 id="plan-curriculum" className={styles.eyebrow}>Tvůj plán ve Studovně</h2>
        {moduleCatalog.map((module, index) => {
          const lessons = getModuleLessons(module.slug).filter((lesson) => lesson.status === "available");
          const count = lessons.filter((lesson) => completed.has(lesson.id)).length;
          const active = module.slug === view.lesson?.moduleSlug;
          return module.status === "available" ? <details key={module.slug} className={styles.chapter} open={active}>
            <summary><span className={styles.chapterNumber}>{String(index + 1).padStart(2, "0")}</span><span className={styles.chapterText}><strong>{module.title}</strong><span>{lessons.length} lekcí · {count > 0 ? `${count} hotovo` : `≈ ${module.estimatedMinutes} min celkem`}</span></span><ChevronDown size={18} className={styles.chapterChevron} aria-hidden="true" /></summary>
            <ol className={styles.lessonList}>{lessons.map((lesson) => {
              const done = completed.has(lesson.id);
              const next = lesson.id === recommendation.nextLessonId;
              return <li key={lesson.id} data-next={next}><Link href={`/learn/${lesson.moduleSlug}/${lesson.slug}`} aria-current={next ? "step" : undefined}>{done ? <Check size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}<span>{lesson.title}</span><span className={styles.rowMeta}>{done ? "Hotovo" : next ? "Tvůj start" : `≈ ${lesson.estimatedMinutes} min`}</span></Link></li>;
            })}</ol>
          </details> : <div key={module.slug} className={styles.plannedChapter}><span className={styles.chapterNumber}>{String(index + 1).padStart(2, "0")}</span><strong>{module.title}</strong><span>Připravujeme</span></div>;
        })}
      </section>
      <div className={styles.planFooter}><Link className={styles.textLink} href="/learn">Zobrazit celé učení</Link><Link className={styles.textLink} href="/settings">Upravit předvolby</Link></div>
      <p className={styles.disclosure}>Vzdělávání, ne investiční doporučení.</p>
    </div>
  </main>;
}
