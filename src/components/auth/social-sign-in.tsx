"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { AuthProviderAvailability } from "@/lib/auth-providers";
import { getSocialAuthErrorMessage } from "@/lib/social-auth-error";

type Provider = keyof AuthProviderAvailability;

function ProviderIcon({ provider }: { provider: Provider }) {
  return provider === "google" ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.36Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z" />
      <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="#0866FF">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.972H15.83c-1.491 0-1.956.931-1.956 1.887v2.262h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z" />
    </svg>
  );
}

export function SocialSignIn({ providers, mode, initialError, callbackURL = "/learn", errorCallbackURL = `/${mode}` }: {
  providers: AuthProviderAvailability;
  mode: "sign-in" | "sign-up";
  initialError?: string;
  callbackURL?: string;
  errorCallbackURL?: string;
}) {
  const [pending, setPending] = useState<Provider>();
  const [error, setError] = useState(initialError);
  const submitting = useRef(false);

  useEffect(() => {
    // Browser Back may restore this page from bfcache after leaving for OAuth.
    const reset = () => { submitting.current = false; setPending(undefined); };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  async function signIn(provider: Provider) {
    if (submitting.current) return;
    submitting.current = true;
    setPending(provider);
    setError(undefined);
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL,
        errorCallbackURL,
      });
      if (!result.error) return; // Keep locked until Better Auth's redirect leaves the page.
      setError(getSocialAuthErrorMessage(result.error.code ?? ""));
    } catch {
      setError(getSocialAuthErrorMessage(""));
    }
    submitting.current = false;
    setPending(undefined);
  }

  const enabled = (["google", "facebook"] as const).filter((provider) => providers[provider]);
  return (
    <>
      {error && <p role="alert" className="mb-5 rounded-control border border-danger-ink/20 bg-surface p-4 text-small text-danger-ink">{error}</p>}
      {enabled.length > 0 && <>
        <div className="space-y-3">
          {enabled.map((provider) => <Button key={provider} variant="secondary" className="w-full gap-3 px-3 font-semibold shadow-none" disabled={!!pending} loading={pending === provider} onClick={() => void signIn(provider)}>
            {pending !== provider && <ProviderIcon provider={provider} />}
            <span>{pending === provider ? `Otevírám ${provider === "google" ? "Google" : "Facebook"}…` : `Pokračovat přes ${provider === "google" ? "Google" : "Facebook"}`}</span>
          </Button>)}
        </div>
        <div className="my-6 flex items-center gap-3 text-center text-small text-secondary">
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
          <span className="max-w-[75%]">{mode === "sign-in" ? "nebo pokračuj e-mailem" : "nebo se zaregistruj e-mailem"}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>
      </>}
    </>
  );
}
