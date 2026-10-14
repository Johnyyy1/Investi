import { ProgressOverview } from "@/components/progress/progress-overview";
import { loadLearner } from "@/features/learning/load-learner";
import { loadPortfolioLedgerSummary, type PortfolioLedgerSummary } from "@/features/portfolio/ledger-summary";
import { perfMeasure, perfSegment } from "@/lib/perf";
import { loadPortfolioLabUnlockStatus } from "@/features/progression/repository";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Pokrok" };

export default function ProgressPage() {
  return perfSegment("page:/progress", renderProgressPage);
}

async function renderProgressPage() {
  const user = await getCurrentUser();
  // The unlock and the saved Lab facts depend only on the user id, so they load alongside the learner reads.
  const [summary, { unlock, portfolio }] = await Promise.all([loadLearner(), user ? loadPortfolioCard(user.id) : { unlock: null, portfolio: null }]);
  return <ProgressOverview summary={summary} unlock={unlock} portfolio={portfolio} />;
}

async function loadPortfolioCard(userId: string) {
  const unlock = await loadPortfolioLabUnlockStatus(userId);
  let portfolio: PortfolioLedgerSummary | null | undefined = null;
  if (unlock.unlocked) {
    try {
      portfolio = await perfMeasure("portfolio.loadLedgerSummary", "compute", () => loadPortfolioLedgerSummary(userId));
    } catch {
      // Saved Lab facts are secondary here; the card says they are unavailable instead of showing zeros.
      portfolio = undefined;
    }
  }
  return { unlock, portfolio };
}
