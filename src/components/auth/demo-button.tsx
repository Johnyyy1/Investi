"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CirclePlay } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DemoButton({ compact = false, className, buttonClassName }: { compact?: boolean; className?: string; buttonClassName?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const router = useRouter();
  async function explore() {
    setPending(true); setError(undefined);
    try {
      // Loaded on click so the auth client stays out of the landing page's first-load JS.
      const { authClient } = await import("@/lib/auth-client");
      // Recover a successful creation whose response was lost, without seeding twice.
      const current = await authClient.getSession();
      if (!current.data) {
        const result = await authClient.signIn.anonymous();
        if (result.error?.status === 429) { setError("Z této sítě se teď otevřelo hodně dem. Zkus to znovu později."); setPending(false); return; }
        if (result.error) throw new Error("Demo se nepodařilo připravit");
      }
      router.replace("/learn"); router.refresh();
    } catch { setError("Demo se nepodařilo otevřít. Zkus to znovu."); setPending(false); }
  }
  return <div className={className ?? "mt-6 border-t border-border pt-6"}>
    <Button variant="secondary" loading={pending} onClick={() => void explore()} className={buttonClassName ?? "w-full"}>{compact && !pending && <CirclePlay aria-hidden="true" />}{pending ? "Otevírám demo…" : "Vyzkoušet demo"}{!compact && <ArrowRight aria-hidden="true" className="size-4" />}</Button>
    {!compact && <p className="mt-3 text-center text-small text-secondary">Začni se soukromým cvičným profilem.</p>}
    {error && <p role="alert" className="mt-3 text-small text-danger-ink">{error}</p>}
  </div>;
}
