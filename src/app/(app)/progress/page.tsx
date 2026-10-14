import { ProgressOverview } from "@/components/progress/progress-overview";
import { loadLearner } from "@/features/learning/load-learner";
import { loadPortfolioLedgerSummary, type PortfolioLedgerSummary } from "@/features/portfolio/ledger-summary";
import { perfMeasure, perfSegment } from "@/lib/perf";
import { loadPortfolioLabUnlock } from "@/features/progression/repository";

export const metadata = { title: "Pokrok" };

export default function ProgressPage() {
  return perfSegment("page:/progress", renderProgressPage);
}

async function renderProgressPage() {
  const summary = await loadLearner();
  const unlock = summary.user ? await loadPortfolioLabUnlock(summary.user.id) : null;
  let portfolio: PortfolioLedgerSummary | null | undefined = null;
  if (summary.user && unlock?.unlocked) {
    try {
      const userId = summary.user.id;
      portfolio = await perfMeasure("portfolio.loadLedgerSummary", "compute", () => loadPortfolioLedgerSummary(userId));
    } catch {
      // Saved Lab facts are secondary here; the card says they are unavailable instead of showing zeros.
      portfolio = undefined;
    }
  }
  return <ProgressOverview summary={summary} unlock={unlock} portfolio={portfolio} />;
}
