import { redirect } from "next/navigation";
import { TrainingLab } from "@/components/lab/training/training-lab";
import { ButtonLink } from "@/components/ui/button";
import { backtestHistoryPlans } from "@/features/backtesting/catalog";
import { isGuestIdentity } from "@/features/guest/identity";
import { portfolioMarketData } from "@/features/portfolio/environment";
import { presentTraining } from "@/features/training/presentation";
import { loadLatestTraining, readTrainingPlanStatus } from "@/features/training/repository";
import { availableScenarios } from "@/features/training/scenarios";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Krizový nácvik" };
export default async function TrainingPage() {
  const owner = await getCurrentUser();
  if (!owner) redirect("/sign-in");
  if (isGuestIdentity(owner)) return <main className="mx-auto max-w-2xl space-y-5 p-5"><h1 className="font-display text-title">Krizový nácvik</h1><p>Nácvik zkouší tvůj uložený investiční plán. Nejdřív si ulož účet.</p><ButtonLink href="/onboarding/save">Uložit účet</ButtonLink></main>;
  const [planStatus, latest] = await Promise.all([readTrainingPlanStatus(owner.id), loadLatestTraining(owner.id)]);
  // Only scenario descriptions reach the client; prices load when a session starts.
  const scenarios = availableScenarios(backtestHistoryPlans[portfolioMarketData.provider]).map(({ id, title, description, kind }) => ({ id, title, description, kind }));
  return <TrainingLab initial={latest && presentTraining(latest.session, latest.setup, latest.state)} scenarios={scenarios} planStatus={planStatus} />;
}
