import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isGuestIdentity } from "@/features/guest/identity";
import { listLearnerArtifactHistory, listLearnerArtifacts } from "@/features/artifacts/repository";
import { readIpsPortfolioId } from "@/features/ips/repository";
import { portfolioMarketData } from "@/features/portfolio/environment";
import { IpsBuilder } from "@/components/ips/ips-builder";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Můj investiční plán" };
export default async function IpsPage() {
  const owner = await getCurrentUser();
  if (!owner) redirect("/sign-in");
  if (isGuestIdentity(owner)) return <main className="mx-auto max-w-2xl space-y-5 p-5"><h1 className="font-display text-title">Můj investiční plán</h1><p>Pro uložení a použití plánu si nejdřív ulož účet.</p><ButtonLink href="/onboarding/save">Uložit účet</ButtonLink></main>;
  const [history, goalMaps, portfolioId] = await Promise.all([listLearnerArtifactHistory(owner.id, "investment_plan"), listLearnerArtifacts(owner.id, "goal_map"), readIpsPortfolioId(owner.id)]);
  const goalMap = goalMaps.find((artifact) => artifact.kind === "goal_map");
  return <IpsBuilder history={history.filter((artifact) => artifact.kind === "investment_plan")} goals={goalMap?.payload.goals} portfolioId={portfolioId} sample={portfolioMarketData.provider === "deterministic"} />;
}
