"use client";
import { AppLink as Link } from "@/components/shell/app-link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetPortfolioAction } from "@/features/portfolio/actions";
import { formatPracticeCapitalMinor } from "@/features/rewards/presentation";
import { Button, buttonVariants } from "@/components/ui/button";
import styles from "./settings.module.css";

export function PortfolioReset({ unlocked, earnedCapital }: { unlocked: boolean; earnedCapital: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const idempotencyKey = useRef<string | null>(null);
  const lock = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  function reset() {
    if (lock.current) return;
    lock.current = true;
    idempotencyKey.current ??= crypto.randomUUID();
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await resetPortfolioAction({ clientIdempotencyKey: idempotencyKey.current });
        if (!result.ok) { setError(result.message); return; }
        idempotencyKey.current = null; dialog.current?.close(); setSuccess(true); router.refresh();
      } catch { setError("Portfolio se nepodařilo resetovat. Zkus to znovu."); }
      finally { lock.current = false; }
    });
  }
  if (!unlocked) return <div className={styles.card}><div className={styles.contentRow}><div><h3>Portfolio Lab je zatím zamčený</h3><p>Dokonči Základy investování a získej potřebné XP. Pak si vyzkoušíš první investici nanečisto.</p></div><Link className={buttonVariants({ variant: "secondary", size: "compact" })} href="/learn">Pokračovat v učení</Link></div></div>;
  return <><div className={styles.card}><div className={styles.contentRow}><div><h3>Začít s portfoliem znovu</h3><p>Současné pozice i mix se uzavřou. Veškerý získaný cvičný kapitál bude znovu k dispozici.</p></div><Button buttonRef={trigger} variant="dangerQuiet" size="compact" onClick={() => { setError(undefined); dialog.current?.showModal(); }}>Začít znovu…</Button></div></div>
    {success && <p className={styles.status} role="status">Portfolio resetováno. Postup v učení i dřívější obchody zůstávají zapsané.</p>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="reset-title" aria-describedby="reset-description" onCancel={(event) => { if (pending) event.preventDefault(); }} onClose={() => trigger.current?.focus()}>
      <h2 id="reset-title">Resetovat portfolio?</h2><p id="reset-description">Pozice i uložený mix se uzavřou. Veškerý získaný cvičný kapitál ({formatPracticeCapitalMinor(BigInt(earnedCapital))}) bude znovu k dispozici jako hotovost.</p>
      <ul><li>Postup v lekcích a diagnostika zůstanou.</li><li>Odměny a dřívější obchody zůstanou zaznamenané.</li><li>Hodnota současných pozic se nepřenese do nového portfolia.</li></ul>
      {error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.actions}><Button variant="secondary" size="compact" autoFocus disabled={pending} onClick={() => dialog.current?.close()}>Ponechat portfolio</Button><Button variant="danger" size="compact" loading={pending} onClick={reset}>{pending ? "Resetuji…" : "Resetovat portfolio"}</Button></div>
    </dialog>
  </>;
}
