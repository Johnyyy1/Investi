import { redirect } from "next/navigation";
import { LockedPortfolioLab } from "@/components/lab/locked-portfolio-lab";
import { PortfolioOverview } from "@/components/lab/portfolio/portfolio-overview";
import { loadPortfolioView } from "@/features/portfolio/service";
import { loadPortfolioLabUnlock } from "@/features/progression/repository";
import { czechPlural } from "@/lib/formatters";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Portfolio Lab" };

function savedNotice(value: string | string[] | undefined) {
  if (typeof value !== "string") return null;
  if (value === "znovu") return { title: "Mix už byl uložený", detail: "Stejné uložení přišlo dvakrát. Nic se neprovedlo podruhé." };
  if (!/^\d{1,2}$/.test(value)) return null;
  const count = Number(value);
  return {
    title: "Mix uložen",
    detail: count === 0
      ? "Rozdíly proti cíli byly menší než 1 Kč, nic se nenakupovalo. Uložily se nové cílové váhy."
      : `Nanečisto ${czechPlural(count, ["proběhl", "proběhly", "proběhlo"])} ${count} ${czechPlural(count, ["obchod", "obchody", "obchodů"])}. Najdeš je v posledních obchodech.`,
  };
}

export default async function PortfolioLabPage({ searchParams }: { searchParams: Promise<{ ulozeno?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const unlock = await loadPortfolioLabUnlock(user.id);
  if (!unlock.unlocked) return <LockedPortfolioLab unlock={unlock} />;
  const [portfolio, params] = await Promise.all([loadPortfolioView(user.id), searchParams]);
  const notice = savedNotice(params.ulozeno);
  // A new save notice in the URL starts a fresh notice state; a reset keeps its own notice.
  return <PortfolioOverview key={notice ? `${params.ulozeno}` : "overview"} view={portfolio} notice={notice} />;
}
