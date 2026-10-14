"use client";
import { AppLink as Link } from "@/components/shell/app-link";
import { useRouter } from "next/navigation";
import { ModulePath, type ModulePathItem } from "@/components/gamification/module-path";
import { AppHeader } from "@/components/shell/app-header";
import { LearningProgressBar } from "./lesson-progress";
import { getModuleBySlug, getModuleLessons } from "@/features/learning/catalog";
import { PageFrame } from "@/components/shell/page-frame";
import { ArrowLeft } from "lucide-react";
import type { evaluateUnlock } from "@/features/progression/unlocks";

type UnlockStatus = ReturnType<typeof evaluateUnlock>;
export function ModuleOverview({ slug, items, completedLessons, portfolioUnlock }: { slug: string; items: ModulePathItem[]; completedLessons: number; portfolioUnlock?: UnlockStatus }) {
  const router = useRouter();
  const learningModule = getModuleBySlug(slug)!;
  const lessons = getModuleLessons(slug);
  const available = lessons.filter((lesson) => lesson.status === "available");
  // The planned Foundations checkpoint remains registered for future authoring, but is not part of the seven-lesson learner path.
  const learnerPath = slug === "investing-foundations" ? items.filter((item) => item.state !== "locked") : items;
  const recommendedId = learnerPath.some((item) => item.state === "active") ? undefined : learnerPath.find((item) => item.state === "available")?.id;
  const displayItems = learnerPath.map((item) => item.id === recommendedId ? { ...item, state: "recommended" as const } : item);
  return <PageFrame width="focused">
    <Link href="/learn" className="inline-flex min-h-12 items-center gap-2 rounded-button px-3 text-small font-bold text-primary-hover hover:bg-primary-soft"><ArrowLeft aria-hidden="true" className="size-4" />Zpět na Učení</Link>
    <div className="mt-4"><AppHeader title={learningModule.title} description={learningModule.description} /></div>
    <section aria-label="Postup modulem" className="mt-7 rounded-surface border border-primary/30 bg-primary-soft px-5 py-5 sm:px-7">
      <div className="mb-3 flex flex-wrap justify-between gap-2 text-small"><p className="font-bold">{completedLessons === available.length ? "Modul dokončen" : "Tvůj postup"}</p><p data-testid="module-progress" className="font-semibold text-secondary">{completedLessons} / {available.length} lekcí dokončeno</p></div>
      <LearningProgressBar value={completedLessons} total={available.length} label={`Postup lekcemi modulu ${learningModule.title}`} />
      {portfolioUnlock ? <div className="mt-5 grid gap-3 border-t border-primary/20 pt-5 text-small min-[420px]:grid-cols-2">
        <p><span className="block text-microcopy font-bold tracking-[0.06em] text-secondary uppercase">XP</span><strong className="mt-1 block tabular-nums">{portfolioUnlock.totalXp} / {portfolioUnlock.xpRequired} XP</strong></p>
        <p><span className="block text-microcopy font-bold tracking-[0.06em] text-secondary uppercase">Portfolio Lab</span><strong className="mt-1 block">{portfolioUnlock.unlocked ? "Odemčen" : "Zamčeno · dokonči základy"}</strong></p>
      </div> : null}
    </section>
    <section className="mt-10 max-w-2xl" aria-labelledby="module-path-title"><p className="text-microcopy font-extrabold tracking-[0.08em] text-primary-hover uppercase">Pořadí lekcí</p><h2 id="module-path-title" className="mt-1 mb-8 text-section-title font-bold">Tvoje studijní cesta</h2>
      <ModulePath items={displayItems} onOpen={(id) => { const lesson = available.find((item) => item.id === id); if (lesson) router.push(`/learn/${slug}/${lesson.slug}`); }} />
    </section>
  </PageFrame>;
}
