import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getLearningProfile, hasLearningHistory } from "@/features/onboarding/repository";
import { defaultPreferences, readLearnerProfile, requiresInitialOnboarding } from "@/features/personalization/profile";
import { diagnosticQuestions, FOUNDATIONS_DIAGNOSTIC_V1 } from "@/features/personalization/diagnostic";
import { PersonalizationFlow } from "@/components/personalization/personalization-flow";

const GUEST_DRAFT_KEY = "investi-personalization-v1:guest:initial";
// Only public prompts/options cross the client boundary. No answer key or diagnostic evidence.
const questions = diagnosticQuestions.map(({ id, prompt, options }) => ({ id, prompt, options }));

export const metadata = { title: "Přizpůsobení učení" };
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ personalize?: string; retake?: string }> }) {
  const user = await getCurrentUser();
  // New learners answer first; a guest identity is created only when they finish (see PersonalizationFlow).
  if (!user) return <PersonalizationFlow key={GUEST_DRAFT_KEY} draftKey={GUEST_DRAFT_KEY} initialPreferences={defaultPreferences} questions={questions} version={FOUNDATIONS_DIAGNOSTIC_V1} guest />;
  const [profile, query] = await Promise.all([getLearningProfile(user.id), searchParams]);
  const learner = readLearnerProfile(profile);
  const retake = query.retake === "1" && learner.personalized;
  if (learner.personalized && !retake) redirect(query.personalize === "1" ? "/onboarding/plan" : "/learn");
  const optional = query.personalize === "1" || query.retake === "1";
  if (!optional && !requiresInitialOnboarding(profile, !profile?.onboardingCompletedAt && await hasLearningHistory(user.id))) redirect("/learn");
  const preferences = { primaryGoal: learner.primaryGoal, interests: learner.interests, selfAssessedExperience: learner.selfAssessedExperience, preferredSessionMinutes: learner.preferredSessionMinutes };
  const draftKey = `investi-personalization-v1:${user.id}:${retake ? "retake" : "initial"}`;
  return <PersonalizationFlow key={draftKey} draftKey={draftKey} initialPreferences={preferences} questions={questions} version={FOUNDATIONS_DIAGNOSTIC_V1} retake={retake} />;
}
