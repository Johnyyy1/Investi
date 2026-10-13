import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsExperience } from "@/components/settings/settings-experience";
import { settingsSections } from "@/components/settings/settings-model";
import { loadLearner } from "@/features/learning/load-learner";
import { readLearnerProfile, requiresInitialOnboarding } from "@/features/personalization/profile";
import { hasLearningHistory } from "@/features/onboarding/repository";
import { loadPortfolioLabUnlock } from "@/features/progression/repository";
import { auth, authProviderAvailability } from "@/lib/auth";
import { mapLinkedAccounts } from "@/lib/auth-accounts";
import { formatDate } from "@/lib/formatters";
import { getSocialAuthErrorMessage } from "@/lib/social-auth-error";

export const metadata = { title: "Profil a nastavení" };
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string; error?: string | string[] }> }) {
  const summary = await loadLearner();
  const { user, profile } = summary;
  if (!user) redirect("/sign-in");
  if (requiresInitialOnboarding(profile, !profile?.onboardingCompletedAt && await hasLearningHistory(user.id))) redirect("/onboarding");
  const learner = readLearnerProfile(profile);
  const params = await searchParams;
  const section = settingsSections.find((item) => item.id === params.section)?.id ?? null;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const [accounts, unlock] = await Promise.all([
    auth.api.listUserAccounts({ headers: await headers() }).then(mapLinkedAccounts).catch(() => null),
    loadPortfolioLabUnlock(user.id),
  ]);
  return <SettingsExperience section={section}
    identity={{ name: user.name, email: user.email, demo: user.isAnonymous === true, since: formatDate(user.createdAt, { timeZone: profile?.timeZone ?? "UTC" }), completed: summary.completed.length, total: summary.lessons.length }}
    initialPreferences={{ primaryGoal: learner.primaryGoal, interests: learner.interests, selfAssessedExperience: learner.selfAssessedExperience, preferredSessionMinutes: learner.preferredSessionMinutes }}
    personalized={learner.personalized} hasDiagnostic={Boolean(learner.diagnostic)} providers={authProviderAvailability} initialAccounts={accounts}
    initialError={errorCode ? getSocialAuthErrorMessage(errorCode) : undefined} portfolioUnlocked={unlock.unlocked} timeZone={profile?.timeZone ?? "UTC"}
    earnedCapital={summary.practiceCapital.earnedPracticeCapitalMinor.toString()} />;
}
