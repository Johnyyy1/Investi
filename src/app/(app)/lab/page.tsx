import { ArrowRight, LockKeyhole } from "lucide-react";
import { LearningLink } from "@/components/learning/learning-button";
import Link from "next/link";
import { AppHeader } from "@/components/shell/app-header";
import { PageFrame } from "@/components/shell/page-frame";
import { getCurrentUser } from "@/lib/session";
import { loadPortfolioLabUnlockStatus } from "@/features/progression/repository";
import { perfSegment } from "@/lib/perf";
export const metadata = { title: "Lab" };
export default function LabPage() {
  return perfSegment("page:/lab", renderLabPage);
}

async function renderLabPage() {
  const user = await getCurrentUser();
  const unlock = user ? await loadPortfolioLabUnlockStatus(user.id) : null;
  return <PageFrame width="standard">
    <p className="text-ql-small font-semibold text-ql-link">Lab</p>
    <div className="mt-3"><AppHeader title="Co se stane, když…" description="Něco změň. Sleduj dopad. Pochop proč." /></div>
    <section className="mt-12 grid gap-8 border-y border-ql-border py-10 sm:grid-cols-[1fr_1fr] sm:items-center">
      <div className="min-w-0 break-words"><h2 className="text-ql-section font-semibold">Sestav portfolio</h2><p className="mt-3 max-w-sm text-ql-body text-ql-secondary">Za získaný virtuální kapitál nakupuj modelové investice a pochop, co vlastníš.</p>{unlock && !unlock.unlocked ? <p className="mt-4 inline-flex items-center gap-2 text-ql-small font-semibold text-ql-secondary"><LockKeyhole aria-hidden="true" className="size-4" />Zamčeno · dokonči Základy investování · {unlock.totalXp} / {unlock.xpRequired} XP</p> : null}<LearningLink href="/lab/portfolio" className="mt-6 w-full whitespace-normal sm:w-auto">{unlock?.unlocked ? "Otevřít Portfolio Lab" : "Zobrazit podmínky odemčení"}<ArrowRight aria-hidden="true" className="size-4" /></LearningLink></div>
      <div aria-hidden="true" className="space-y-5 sm:pl-8">{[["Akcie", "60 %", "bg-ql-blue-500"], ["Dluhopisy", "30 %", "bg-ql-warning"], ["Hotovost", "10 %", "bg-ql-success"]].map(([name, width, color]) => <div key={name}><div className="mb-2 flex justify-between text-ql-small"><span>{name}</span><span>{width}</span></div><div className="h-3 rounded-full bg-ql-border"><div className={`h-3 rounded-full ${color}`} style={{ width }} /></div></div>)}</div>
    </section>
    <Link href="/lab/backtesting" className="group flex items-center justify-between gap-5 py-8"><div className="min-w-0 break-words"><p className="text-ql-small text-ql-secondary">Ukázková data · syntetické měsíční výnosy</p><h2 className="mt-2 text-ql-section font-semibold group-hover:text-ql-link">Sleduj investici v čase</h2><p className="mt-3 text-ql-body text-ql-secondary">Prozkoumej růst, drawdown a cestu mezi nimi.</p><span className="mt-4 inline-block text-ql-small font-semibold text-ql-link">Otevřít Backtesting Lab</span></div><ArrowRight aria-hidden="true" className="size-6 shrink-0 text-ql-link" /></Link>
  </PageFrame>;
}
