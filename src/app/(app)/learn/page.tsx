import { loadLearner } from "@/features/learning/load-learner";
import { loadPortfolioLabUnlock } from "@/features/progression/repository";
import { loadPortfolioView, type PortfolioView } from "@/features/portfolio/service";
import { StudovnaPage } from "@/components/learning/studovna-page";

export const metadata = { title: "Studovna" };
export default async function LearnPage() {
  const summary = await loadLearner();
  let portfolio: PortfolioView | null | undefined;
  if (summary.user) {
    try {
      const unlock = await loadPortfolioLabUnlock(summary.user.id);
      portfolio = unlock.unlocked ? await loadPortfolioView(summary.user.id) : null;
    } catch {
      // Unavailable portfolio data is explicit; learning can still continue.
      portfolio = undefined;
    }
  }
  return <StudovnaPage summary={summary} portfolio={portfolio} />;
}
