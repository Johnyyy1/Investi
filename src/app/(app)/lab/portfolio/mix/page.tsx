import { redirect } from "next/navigation";
import { LockedPortfolioLab } from "@/components/lab/locked-portfolio-lab";
import { initialMix } from "@/components/lab/portfolio/lab-model";
import { MixBuilder } from "@/components/lab/portfolio/mix-builder";
import { loadAllocationQuotes, loadPortfolioView } from "@/features/portfolio/service";
import { loadPortfolioLabUnlock } from "@/features/progression/repository";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Sestavit mix | Portfolio Lab" };

export default async function PortfolioMixPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const unlock = await loadPortfolioLabUnlock(user.id);
  if (!unlock.unlocked) return <LockedPortfolioLab unlock={unlock} />;
  const view = await loadPortfolioView(user.id);
  const initial = initialMix(view);
  const instrumentIds = [...new Set([...initial.lines.map(({ instrumentId }) => instrumentId), ...view.holdings.map(({ instrumentId }) => instrumentId)])];
  const quotes = instrumentIds.length ? await loadAllocationQuotes(instrumentIds) : [];
  return <MixBuilder view={view} initial={initial} quotes={quotes} />;
}
