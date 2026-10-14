import { loadLearner } from "@/features/learning/load-learner";
import { loadPortfolioLabUnlock } from "@/features/progression/repository";
import { loadPortfolioView, type PortfolioView } from "@/features/portfolio/service";
import { perfMeasure, perfSegment } from "@/lib/perf";
import { StudovnaPage } from "@/components/learning/studovna-page";

export const metadata = { title: "Studovna" };
export default function LearnPage() {
  return perfSegment("page:/learn", renderLearnPage);
}

async function renderLearnPage() {
  const summary = await loadLearner();
  let portfolio: PortfolioView | null | undefined;
  if (summary.user) {
    try {
      const userId = summary.user.id;
      const unlock = await loadPortfolioLabUnlock(userId);
      portfolio = unlock.unlocked ? await perfMeasure("portfolio.loadPortfolioView", "compute", () => loadPortfolioView(userId)) : null;
    } catch {
      // Unavailable portfolio data is explicit; learning can still continue.
      portfolio = undefined;
    }
  }
  return <StudovnaPage summary={summary} portfolio={portfolio} />;
}
