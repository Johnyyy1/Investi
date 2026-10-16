import { Streak } from "./streak";
import { DailyGoal } from "./daily-goal";
import type { LearningMomentum } from "@/features/progress/contracts";
import { formatPracticeCapitalMinor, type SerializedPracticeCapitalMinor } from "@/features/rewards/presentation";

export function LearningStats({ stats, earnedPracticeCapitalMinor, goal = false }: { stats: LearningMomentum; earnedPracticeCapitalMinor: bigint | SerializedPracticeCapitalMinor; goal?: boolean }) {
  const formattedCapital = formatPracticeCapitalMinor(earnedPracticeCapitalMinor);
  return <div data-testid="learning-stats">
    <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3 sm:gap-x-6">
      <span className="min-w-0 text-small" aria-label={`Virtuální kapitál: ${formattedCapital}`}><span className="block text-microcopy font-semibold text-secondary">Virtuální kapitál</span><span className="block break-words font-bold text-primary" data-testid="total-practice-capital" aria-hidden="true">{formattedCapital}</span></span>
      <Streak days={stats.streak} />
    </div>
    {goal && <div className="mt-6 max-w-sm"><DailyGoal completed={stats.todayCompleted} target={stats.dailyTarget} /></div>}
  </div>;
}
