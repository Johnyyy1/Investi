import { ProgressOverview } from "@/components/progress/progress-overview";
import { loadLearner } from "@/features/learning/load-learner";
import { loadPortfolioLedgerSummary, type PortfolioLedgerSummary } from "@/features/portfolio/ledger-summary";
import { perfMeasure, perfSegment } from "@/lib/perf";
import { loadPortfolioLabUnlockStatus } from "@/features/progression/repository";
import { practiceCapitalLedger } from "@/features/rewards/practice-capital";
import { loadPracticeCapitalLedger } from "@/features/rewards/repository";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Pokrok" };

export default function ProgressPage() {
  return perfSegment("page:/progress", renderProgressPage);
}

async function renderProgressPage() {
  const user = await getCurrentUser();
  // The unlock, the saved Lab facts and the capital receipts depend only on the user id, so they load alongside the learner reads.
  const [summary, { unlock, portfolio }, capital] = await Promise.all([
    loadLearner(),
    user ? loadPortfolioCard(user.id) : { unlock: null, portfolio: null },
    user ? perfMeasure("rewards.loadLedger", "db", () => loadPracticeCapitalLedger(user.id)) : practiceCapitalLedger([]),
  ]);
  return <ProgressOverview summary={summary} unlock={unlock} portfolio={portfolio} capital={capital} />;
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
