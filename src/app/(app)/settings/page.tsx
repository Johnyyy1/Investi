import { hasSuppressedEmail } from "@/features/email/repository";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsExperience } from "@/components/settings/settings-experience";
import { settingsSections } from "@/components/settings/settings-model";
import { loadLearner } from "@/features/learning/load-learner";
import { readLearnerProfile, requiresInitialOnboarding } from "@/features/personalization/profile";
import { hasLearningHistory } from "@/features/onboarding/repository";
import { isDemoIdentity, isGuestIdentity } from "@/features/guest/identity";
import { loadPortfolioLabUnlockStatus } from "@/features/progression/repository";
import { auth, authProviderAvailability } from "@/lib/auth";
import { mapLinkedAccounts } from "@/lib/auth-accounts";
import { formatDate } from "@/lib/formatters";
import { getSocialAuthErrorMessage } from "@/lib/social-auth-error";
import { getCurrentSession, getCurrentUser } from "@/lib/session";
import { isFreshForAccountDeletion } from "@/features/account/deletion";
import { hasPasswordCredential } from "@/features/account/repository";

export const metadata = { title: "Profil a nastavení" };
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string; error?: string | string[]; delete?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // Independent reads keyed by the user; none of them writes for an account that still needs onboarding.
  const [summary, accounts, unlock, params, session, hasPassword, emailSuppressed] = await Promise.all([
    loadLearner(),
    auth.api.listUserAccounts({ headers: await headers() }).then(mapLinkedAccounts).catch(() => null),
    loadPortfolioLabUnlockStatus(user.id),
    searchParams,
    getCurrentSession(),
    // Unknown (null) when sign-in methods cannot be read; deletion then asks for a reload instead of guessing.
    user.isAnonymous ? false : hasPasswordCredential(user.id).catch(() => null),
    user.isAnonymous ? false : hasSuppressedEmail(user.id),
  ]);
  const { profile } = summary;
  if (requiresInitialOnboarding(profile, !profile?.onboardingCompletedAt && await hasLearningHistory(user.id))) redirect("/onboarding");
  const learner = readLearnerProfile(profile);
  const section = settingsSections.find((item) => item.id === params.section)?.id ?? null;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  // Rendered per request, so freshness is measured now; the server checks it again on deletion.
  const fresh = session ? isFreshForAccountDeletion(new Date(session.createdAt)) : false;
  return <SettingsExperience section={section}
    identity={{ name: user.name, email: user.email, emailVerified: user.emailVerified, emailSuppressed, demo: isDemoIdentity(user), guest: isGuestIdentity(user), since: formatDate(user.createdAt, { timeZone: profile?.timeZone ?? "UTC" }), completed: summary.completed.length, total: summary.lessons.length }}
    initialPreferences={{ primaryGoal: learner.primaryGoal, interests: learner.interests, selfAssessedExperience: learner.selfAssessedExperience, preferredSessionMinutes: learner.preferredSessionMinutes }}
    personalized={learner.personalized} hasDiagnostic={Boolean(learner.diagnostic)} providers={authProviderAvailability} initialAccounts={accounts}
    initialError={errorCode ? getSocialAuthErrorMessage(errorCode) : undefined} portfolioUnlocked={unlock.unlocked} timeZone={profile?.timeZone ?? "UTC"}
    earnedCapital={summary.practiceCapital.earnedPracticeCapitalMinor.toString()}
    deletion={{ hasPassword, fresh, reopen: section === "data" && params.delete === "confirm" && fresh }} />;
}
