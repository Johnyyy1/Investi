import { OnboardingGuide, OnboardingHeader } from "@/components/personalization/onboarding-frame";
import styles from "@/components/personalization/personalization-flow.module.css";

export default function LoadingPersonalization() {
  return <main className={styles.flow}><OnboardingHeader progress={0} disabled /><div className={styles.column}><OnboardingGuide pose="02-thinking">Načítám tvé předvolby…</OnboardingGuide></div></main>;
}
