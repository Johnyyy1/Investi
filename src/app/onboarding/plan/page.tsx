import { redirect } from "next/navigation";
import { loadLearner } from "@/features/learning/load-learner";
import { readLearnerProfile } from "@/features/personalization/profile";
import { StudyPlan } from "@/components/personalization/study-plan";

export const metadata = { title: "Tvůj plán", robots: { index: false, follow: false } };
export default async function PlanPage() {
  const summary = await loadLearner();
  if (!summary.user) redirect("/sign-in");
  if (!summary.profile?.onboardingCompletedAt) redirect("/onboarding");
  const profile = readLearnerProfile(summary.profile);
  return <StudyPlan profile={profile} recommendation={summary.recommendation} states={summary.states} />;
}
