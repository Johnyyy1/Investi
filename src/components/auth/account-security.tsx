"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AuthProviderAvailability } from "@/lib/auth-providers";
import { authClient } from "@/lib/auth-client";
import { mapLinkedAccounts, type LinkedAccountState } from "@/lib/auth-accounts";
import { getSocialAuthErrorMessage } from "@/lib/social-auth-error";
import styles from "@/components/settings/settings.module.css";

type SocialProvider = "google" | "facebook";

const providerLabels: Record<SocialProvider, string> = { google: "Google", facebook: "Facebook" };

function getAccountSecurityErrorMessage(code?: string) {
  switch (code?.toLowerCase()) {
    case "failed_to_unlink_last_account":
    case "cannot_unlink_last_account":
      return "Nejdřív si připoj jiný způsob přihlášení.";
    case "account_not_found":
      return "Tento způsob přihlášení už není připojený.";
    case "account_already_linked_to_different_user":
    case "unable_to_link_account":
    case "email_does_not_match":
    case "email_not_verified":
      return "Účet nelze bezpečně propojit. Zkontroluj přihlášený účet a zkus to znovu.";
    case "provider_not_found":
    case "oauth_provider_not_found":
      return "Tento způsob přihlášení teď není dostupný.";
    default:
      return "Operaci se nepodařilo dokončit. Zkus to znovu.";
  }
}

export function AccountSecurity({ providers, initialError, initialAccounts }: {
  providers: AuthProviderAvailability;
  initialError?: string;
  initialAccounts?: LinkedAccountState | null;
}) {
  const [accounts, setAccounts] = useState<LinkedAccountState | undefined>(initialAccounts ?? undefined);
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState<"load" | SocialProvider | `unlink-${SocialProvider}` | undefined>(initialAccounts ? undefined : "load");
  const lock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const disconnectTrigger = useRef<HTMLButtonElement | null>(null);
  const [disconnecting, setDisconnecting] = useState<SocialProvider>();

  async function refreshAccounts() {
    setPending("load");
    setError(undefined);
    try {
      const result = await authClient.listAccounts();
      if (result.error) {
        setError(getAccountSecurityErrorMessage(result.error.code));
        return;
      }
      setAccounts(mapLinkedAccounts(result.data ?? []));
    } catch {
      setError("Způsoby přihlášení se nepodařilo načíst. Zkus to znovu.");
    } finally {
      setPending(undefined);
    }
  }

  useEffect(() => {
    if (initialAccounts) return;
    let active = true;
    void authClient.listAccounts().then((result) => {
      if (!active) return;
      if (result.error) setError(getAccountSecurityErrorMessage(result.error.code));
      else setAccounts(mapLinkedAccounts(result.data ?? []));
      setPending(undefined);
    }).catch(() => {
      if (!active) return;
      setError("Způsoby přihlášení se nepodařilo načíst. Zkus to znovu.");
      setPending(undefined);
    });
    return () => { active = false; };
  }, [initialAccounts]);

  async function connect(provider: SocialProvider) {
    if (pending || lock.current) return;
    lock.current = true;
    setError(undefined);
    setPending(provider);
    try {
      const result = await authClient.linkSocial({ provider, callbackURL: "/settings", errorCallbackURL: "/settings" });
      if (result.error) setError(getSocialAuthErrorMessage(result.error.code ?? ""));
    } catch {
      setError(getAccountSecurityErrorMessage());
    } finally {
      setPending(undefined);
      lock.current = false;
    }
  }

  async function disconnect(provider: SocialProvider) {
    const account = accounts?.[provider];
    if (!account || pending || lock.current) return;
    lock.current = true;
    setError(undefined);
    setPending(`unlink-${provider}`);
    try {
      const result = await authClient.unlinkAccount({ accountId: account.id });
      if (result.error) {
        setError(getAccountSecurityErrorMessage(result.error.code));
      } else {
        await refreshAccounts();
        dialog.current?.close();
      }
    } catch {
      setError(getAccountSecurityErrorMessage());
    } finally {
      setPending(undefined);
      lock.current = false;
    }
  }

  return <section className={styles.security} aria-labelledby="account-security-title">
    <h2 id="account-security-title" className="text-section-title font-bold">Přihlášení a zabezpečení</h2>
    <p className="mt-2 max-w-2xl text-body text-secondary">Spravuj způsoby, kterými se přihlašuješ do svého účtu.</p>
    {error ? <p className="mt-5 rounded-control border border-danger-ink/20 bg-surface p-4 text-small text-danger-ink" role="alert">{error}</p> : null}
    <div className="mt-6" aria-busy={pending === "load"}>
      <h3 className="text-card-title font-bold">Způsoby přihlášení</h3>
      {accounts ? <div className="mt-3 divide-y divide-border border-y border-border">
        <AccountRow label="E-mail a heslo" connected={Boolean(accounts.credential)} />
        {(["google", "facebook"] as const).map((provider) => <AccountRow key={provider} label={providerLabels[provider]} connected={Boolean(accounts[provider])} available={providers[provider]} disabled={Boolean(pending)} pending={pending === provider || pending === `unlink-${provider}`} onConnect={() => void connect(provider)} onDisconnect={(event) => { disconnectTrigger.current = event.currentTarget; setDisconnecting(provider); setError(undefined); dialog.current?.showModal(); }} />)}
      </div> : pending === "load" ? <p className="mt-3 text-small text-secondary" role="status">Načítám způsoby přihlášení…</p> : <Button variant="secondary" size="compact" onClick={() => void refreshAccounts()}>Zkusit načíst znovu</Button>}
    </div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="unlink-title" aria-describedby="unlink-description" onCancel={(event) => { if (pending) event.preventDefault(); }} onClose={() => disconnectTrigger.current?.focus()}><h2 id="unlink-title">Odpojit {disconnecting && providerLabels[disconnecting]}?</h2><p id="unlink-description">Tento způsob už nebude sloužit k přihlášení. Poslední způsob přihlášení nelze odpojit. Tvůj účet, lekce a portfolio zůstanou.</p>{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.actions}><Button variant="secondary" size="compact" autoFocus disabled={Boolean(pending)} onClick={() => dialog.current?.close()}>Ponechat připojení</Button><Button variant="danger" size="compact" loading={Boolean(pending)} onClick={() => { if (disconnecting) void disconnect(disconnecting); }}>Odpojit</Button></div></dialog>
  </section>;
}

function AccountRow({ label, connected, available = true, pending, disabled, onConnect, onDisconnect }: {
  label: string;
  connected: boolean;
  available?: boolean;
  pending?: boolean;
  disabled?: boolean;
  onConnect?: () => void;
  onDisconnect?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return <div className="flex flex-col gap-3 py-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
    <div><p className="text-body font-semibold">{label}</p><p className={`mt-1 text-small ${connected ? "text-success-ink" : "text-secondary"}`}>{connected ? "Připojeno" : available ? "Nepřipojeno" : "Není dostupné"}</p></div>
    {connected && onDisconnect ? <Button variant="secondary" size="compact" disabled={disabled} loading={pending} onClick={onDisconnect} aria-label={`Odpojit ${label}`}>Odpojit</Button> : !connected && available && onConnect ? <Button variant="secondary" size="compact" disabled={disabled} loading={pending} onClick={onConnect} aria-label={`Připojit ${label}`}>Připojit</Button> : null}
  </div>;
}
