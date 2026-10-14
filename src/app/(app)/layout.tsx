import { redirect } from "next/navigation";
import { requiresInitialOnboarding } from "@/features/personalization/profile";
import { getLearningProfile, hasLearningHistory } from "@/features/onboarding/repository";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/session";
import { loadPortfolioLabUnlock } from "@/features/progression/repository";
import { perfMeasure, perfSegment } from "@/lib/perf";

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return perfSegment("layout:(app)", () => renderApplicationLayout(children));
}

async function renderApplicationLayout(children: React.ReactNode) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const profile = await perfMeasure("layout.learningProfile", "db", () => getLearningProfile(user.id));
  if (requiresInitialOnboarding(profile, !profile?.onboardingCompletedAt && await perfMeasure("layout.hasLearningHistory", "db", () => hasLearningHistory(user.id)))) redirect("/onboarding");
  const portfolioLabUnlock = await loadPortfolioLabUnlock(user.id);
  return <AppShell userName={user.name} isDemo={user.isAnonymous === true} needsTimeZone={!profile?.timeZone} portfolioLabLocked={!portfolioLabUnlock.unlocked}>{children}</AppShell>;
}
