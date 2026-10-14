import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requiresInitialOnboarding } from "@/features/personalization/profile";
import { getLearningProfile, hasLearningHistory } from "@/features/onboarding/repository";
import { AppShell } from "@/components/app-shell";
import { AppRouteFallback } from "@/components/shell/app-route-fallback";
import { getCurrentUser } from "@/lib/session";
import { loadPortfolioLabUnlockStatus } from "@/features/progression/repository";
import { perfMeasure, perfSegment } from "@/lib/perf";

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return perfSegment("layout:(app)", () => renderApplicationLayout(children));
}

async function renderApplicationLayout(children: React.ReactNode) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // Both need only the user id. The page renders in parallel and reads the same memoized values.
  // An account that still needs onboarding has no learning history and is not a demo, so its
  // unlock check is a plain read that records nothing before the redirect below.
  const [profile, portfolioLabUnlock] = await Promise.all([
    perfMeasure("layout.learningProfile", "db", () => getLearningProfile(user.id)),
    loadPortfolioLabUnlockStatus(user.id),
  ]);
  if (requiresInitialOnboarding(profile, !profile?.onboardingCompletedAt && await perfMeasure("layout.hasLearningHistory", "db", () => hasLearningHistory(user.id)))) redirect("/onboarding");
  return <AppShell userName={user.name} isDemo={user.isAnonymous === true} needsTimeZone={!profile?.timeZone} portfolioLabLocked={!portfolioLabUnlock.unlocked}>
    {/* One boundary that stays mounted across navigations. On a full load it streams the shell and this
        fallback first. On a client navigation it is already showing content, so React keeps the current
        page until the next one is ready instead of committing a fallback; a route-level loading.tsx would
        mount a new boundary each time, and React holds content revealed into a fresh fallback for ~300 ms. */}
    <Suspense fallback={<AppRouteFallback />}>{children}</Suspense>
  </AppShell>;
}
