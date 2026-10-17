import { loadLearner } from "@/features/learning/load-learner";
import { loadPortfolioLabUnlockStatus } from "@/features/progression/repository";
import { loadPortfolioView, type PortfolioView } from "@/features/portfolio/service";
import { perfMeasure, perfSegment } from "@/lib/perf";
import { getCurrentUser } from "@/lib/session";
import { StudovnaPage } from "@/components/learning/studovna-page";

export const metadata = { title: "Učení" };
export default function LearnPage() {
  return perfSegment("page:/learn", renderLearnPage);
}

async function renderLearnPage() {
  const user = await getCurrentUser();
  // The portfolio card depends only on the user id, so it loads alongside the learner reads.
  const [summary, portfolio] = await Promise.all([loadLearner(), user ? loadPortfolioCard(user.id) : undefined]);
  return <StudovnaPage summary={summary} portfolio={portfolio} />;
}

async function loadPortfolioCard(userId: string): Promise<PortfolioView | null | undefined> {
  try {
    const unlock = await loadPortfolioLabUnlockStatus(userId);
    return unlock.unlocked ? await perfMeasure("portfolio.loadPortfolioView", "compute", () => loadPortfolioView(userId)) : null;
  } catch {
    // Unavailable portfolio data is explicit; learning can still continue.
    return undefined;
  }
}
