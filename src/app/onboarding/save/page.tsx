import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { OnboardingGuide, OnboardingHeader } from "@/components/personalization/onboarding-frame";
import styles from "@/components/personalization/personalization-flow.module.css";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { SocialSignIn } from "@/components/auth/social-sign-in";
import { isGuestIdentity } from "@/features/guest/identity";
import { loadLearner } from "@/features/learning/load-learner";
import { formatPracticeCapitalMinor } from "@/features/rewards/presentation";
import { authProviderAvailability } from "@/lib/auth";
import { getSocialAuthErrorMessage } from "@/lib/social-auth-error";

export const metadata = { title: "Ulož si pokrok" };

/** Pen onboarding step 6: the account comes after the first finished lesson and takes the guest's learning over. */
export default async function SaveProgressPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const [summary, { error }] = await Promise.all([loadLearner(), searchParams]);
  if (!summary.user) redirect("/onboarding");
  if (!isGuestIdentity(summary.user)) redirect("/learn");
  const errorCode = Array.isArray(error) ? error[0] : error;
  const lessons = summary.completed.length;
  const xp = summary.gamification?.totalXp ?? 0;
  const capital = summary.practiceCapital.earnedPracticeCapitalMinor;
  return <main className={`investi-theme ${styles.flow}`}>
    <OnboardingHeader progress={1} back="/learn" trailing={<p className={styles.accountHint}>Už máš účet? <Link className={styles.accountLink} href="/sign-in">Přihlásit se</Link></p>} />
    <div className={styles.column}>
      <OnboardingGuide pose="07-small-joy">{lessons > 0 ? "Plán i první lekce jsou hotové. Ulož si je, ať o ně nepřijdeš." : "Plán je hotový. Ulož si ho, ať o něj nepřijdeš."}</OnboardingGuide>
      <section className={styles.questionCard} aria-labelledby="save-progress-title">
        <p className={styles.eyebrow}>Hotovo</p>
        <h1 id="save-progress-title" className={styles.questionTitle}>Ulož si, co už víš.</h1>
        <dl className={styles.saveStats}>
          <div><dt>{lessons >= 1 && lessons <= 4 ? "lekce" : "lekcí"}</dt><dd>{lessons}</dd></div>
          <div><dt>XP</dt><dd>{xp}</dd></div>
          {capital > 0n ? <div><dt>cvičného kapitálu</dt><dd>{formatPracticeCapitalMinor(capital)}</dd></div> : <div><dt>plán připravený</dt><dd><CheckCircle2 aria-label="ano" size={28} /></dd></div>}
        </dl>
        <div className={styles.authFields}>
          <SocialSignIn providers={authProviderAvailability} mode="sign-up" initialError={errorCode !== undefined ? getSocialAuthErrorMessage(errorCode) : undefined} callbackURL="/learn" errorCallbackURL="/onboarding/save" />
          <SignUpForm redirectTo="/learn" />
        </div>
        <p className={styles.consent}>Vytvořením účtu souhlasíš s <Link href="/terms">podmínkami použití</Link>. Jak zacházíme s tvými údaji, popisují <Link href="/privacy">zásady ochrany osobních údajů</Link>.</p>
        <div className={styles.saveLater}>
          <Link className={styles.textLink} href="/learn">Teď ne</Link>
          <p>Pokrok zatím zůstane jen v tomhle prohlížeči. Když ho vymažeš nebo přejdeš na jiné zařízení, můžeš o něj přijít.</p>
        </div>
      </section>
      <p className={styles.disclosure}>Vzdělávání, ne investiční doporučení. <Link href="/privacy">Ochrana osobních údajů</Link> · <Link href="/terms">Podmínky použití</Link></p>
    </div>
  </main>;
}
