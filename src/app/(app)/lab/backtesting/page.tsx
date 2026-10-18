import { BacktestingLab } from "@/components/lab/backtesting-lab";
import { backtestHistoryPlans, historyView } from "@/features/backtesting/catalog";
import { portfolioMarketData } from "@/features/portfolio/environment";
export const metadata = { title: "Backtesting Lab" };
export default function BacktestingLabPage() {
  // Only the configured provider's fixed plan reaches the client; prices load when a run starts.
  return <BacktestingLab history={historyView(backtestHistoryPlans[portfolioMarketData.provider])} />;
}
