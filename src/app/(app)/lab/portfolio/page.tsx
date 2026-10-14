import { redirect } from "next/navigation";
import { LockedPortfolioLab } from "@/components/lab/locked-portfolio-lab";
import { PortfolioOverview } from "@/components/lab/portfolio/portfolio-overview";
import { loadPortfolioView } from "@/features/portfolio/service";
import { loadPortfolioLabUnlock } from "@/features/progression/repository";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Portfolio Lab" };

export default async function PortfolioLabPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const unlock = await loadPortfolioLabUnlock(user.id);
  if (!unlock.unlocked) return <LockedPortfolioLab unlock={unlock} />;
  return <PortfolioOverview view={await loadPortfolioView(user.id)} />;
}
