import type { CSSProperties } from "react";
import { AppLink as Link } from "@/components/shell/app-link";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import { getModuleLessons, moduleCatalog } from "@/features/learning/catalog";
import type { loadLearner } from "@/features/learning/load-learner";
import styles from "./journey-overview.module.css";

const statusCopy = {
  completed: "Dokončeno",
  current: "Rozpracováno",
  available: "Připraveno",
  locked: "Připravujeme",
} as const;

export function JourneyOverview({ summary }: { summary: Awaited<ReturnType<typeof loadLearner>> }) {
  const modules = moduleCatalog.filter((module) => module.status === "available");
  return <section className="mt-12 sm:mt-16" aria-labelledby="journey-title">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-microcopy font-extrabold tracking-[0.08em] text-primary-hover uppercase">Studijní plán</p><h2 id="journey-title" className="mt-1 text-section-title font-bold tracking-[-0.02em]">Tvoje cesta</h2></div>
      <p className="max-w-md text-small text-secondary">Podívej se, co už máš hotové a co následuje.</p>
    </div>
    <div className="space-y-5" data-testid="journey-modules">{modules.map((module, moduleIndex) => {
      const lessons = getModuleLessons(module.slug);
      const completed = lessons.filter((lesson) => summary.completed.some((item) => item.id === lesson.id)).length;
      return <section key={module.slug} className="overflow-hidden rounded-surface border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-7">
          <div className="min-w-0"><p className="text-microcopy font-bold text-secondary">MODUL {String(moduleIndex + 1).padStart(2, "0")}</p><h3 className="mt-1 break-words text-card-title font-bold">{module.title}</h3><p className="mt-1 text-small text-secondary">Dokončeno {completed} z {module.lessonCount}</p></div>
          <Link href={`/learn/${module.slug}`} className="inline-flex min-h-12 min-w-0 items-center gap-2 rounded-button px-2 font-bold text-primary-hover transition-colors hover:bg-primary-soft sm:px-4"><span className="min-w-0 break-words">Zobrazit modul</span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link>
        </div>
        <ol className={styles.path} style={{ "--journey-count": lessons.length } as CSSProperties} aria-label={`Postup lekcemi modulu ${module.title}`}>{lessons.map((lesson, index) => {
          const learnerState = summary.states.find((state) => state.lessonId === lesson.id)?.status;
          const status = lesson.status !== "available" ? "locked" : learnerState === "completed" ? "completed" : learnerState === "in_progress" || summary.next.id === lesson.id ? "current" : "available";
          const label = `${lesson.title}: ${statusCopy[status]}`;
          return <li key={lesson.id} className={styles.step} aria-current={status === "current" ? "step" : undefined}>
            <span className={`${styles.marker} ${styles[status]}`} aria-hidden="true">{status === "completed" ? <Check className="size-4" /> : status === "locked" ? <LockKeyhole className="size-4" /> : index + 1}</span>
            <div className="min-w-0"><p className="break-words text-small font-bold leading-snug">{lesson.title}</p><p className={`mt-1 text-microcopy font-semibold ${status === "completed" ? "text-success-ink" : status === "current" ? "text-primary-hover" : "text-secondary"}`}>{statusCopy[status]}</p><span className="sr-only">{label}</span></div>
          </li>;
        })}</ol>
      </section>;
    })}</div>
    <p className="mt-5 text-small text-secondary">Dále ve studijním plánu: volatilita a korelace.</p>
  </section>;
}
