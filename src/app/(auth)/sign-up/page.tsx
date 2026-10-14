import { redirect } from "next/navigation";

/** Registration is the last onboarding step now; keep old links and OAuth error returns working. */
export default async function SignUpPage({ searchParams }: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;
  // OAuth errors from the save screen return there; anything else starts onboarding.
  redirect(errorCode ? `/onboarding/save?error=${encodeURIComponent(errorCode)}` : "/onboarding");
}
