"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteArtifact, listArtifacts } from "@/features/artifacts/actions";
import type { LearnerArtifact } from "@/features/artifacts/schemas";
import { artifactLabels } from "@/features/artifacts/presentation";
import { formatDate } from "@/lib/formatters";
import styles from "./settings.module.css";

export function ArtifactData() {
  const [artifacts, setArtifacts] = useState<LearnerArtifact[]>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [confirming, setConfirming] = useState<string>();
  const [pending, setPending] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const lock = useRef(false);
  async function load() {
    try {
      const result = await listArtifacts();
      setError(undefined);
      if (result.ok) setArtifacts(result.artifacts);
      else setError(result.message);
    } catch { setError("Výstupy se nepodařilo načíst. Zkus to znovu."); }
  }
  useEffect(() => {
    let active = true;
    void listArtifacts().then((result) => {
      if (!active) return;
      if (result.ok) setArtifacts(result.artifacts);
      else setError(result.message);
    }, () => { if (active) setError("Výstupy se nepodařilo načíst. Zkus to znovu."); });
    return () => { active = false; };
  }, []);

  async function remove(artifact: LearnerArtifact) {
    if (lock.current) return;
    lock.current = true; setPending(artifact.id); setError(undefined); setMessage(undefined);
    try {
      const result = await deleteArtifact({ id: artifact.id });
      if (result.ok) {
        setConfirming(undefined);
        setArtifacts((current) => current?.filter((item) => item.id !== artifact.id));
        setMessage(`${(artifact.title ?? artifactLabels[artifact.kind])}: všechny verze jsou smazané.`);
        heading.current?.focus();
      } else setError(result.message);
    } catch { setError("Výstup se nepodařilo smazat. Zkus to znovu."); }
    finally { lock.current = false; setPending(undefined); }
  }

  return <div className="mt-12" aria-labelledby="artifact-data-title">
    <div className={styles.sectionHead}><h2 id="artifact-data-title" ref={heading} tabIndex={-1}>Výstupy z lekcí</h2><p>Mapa cílů, plán a další uložené výstupy. Smazání odstraní všechny verze daného výstupu. Dokončené lekce a odměny zůstanou.</p></div>
    {artifacts === undefined && !error && <p className={styles.hint} role="status">Načítám výstupy…</p>}
    {artifacts?.length === 0 && <p className={styles.hint}>Zatím tu nemáš žádné uložené výstupy.</p>}
    {artifacts && artifacts.length > 0 && <ul className="divide-y divide-divider">
      {artifacts.map((artifact) => <li key={artifact.id} className="py-4">
        <div className={styles.contentRow}><div className="min-w-0"><h3>{(artifact.title ?? artifactLabels[artifact.kind])}</h3><p className={styles.hint}>Verze {artifact.version} · {formatDate(new Date(artifact.createdAt))}</p></div>
          <Button variant="dangerQuiet" size="compact" disabled={Boolean(pending)} onClick={(event) => { deleteTrigger.current = event.currentTarget; setConfirming(artifact.id); setError(undefined); setMessage(undefined); }} aria-label={`Smazat: ${(artifact.title ?? artifactLabels[artifact.kind])}`}>Smazat…</Button></div>
        {confirming === artifact.id && <div className="mt-3 space-y-3">
          <p>Trvale smazat výstup „{(artifact.title ?? artifactLabels[artifact.kind])}“ a všechny předchozí verze? Výstup bude potřeba pro navazující cvičení vytvořit znovu.</p>
          <div className={styles.actions}><Button variant="secondary" size="compact" disabled={Boolean(pending)} onClick={() => { setConfirming(undefined); deleteTrigger.current?.focus(); }}>Ponechat výstup</Button><Button variant="danger" size="compact" loading={pending === artifact.id} onClick={() => void remove(artifact)}>Smazat všechny verze</Button></div>
        </div>}
      </li>)}
    </ul>}
    {error && <div><p className={styles.error} role="alert">{error}</p>{artifacts === undefined && <Button variant="secondary" size="compact" onClick={() => void load()}>Načíst znovu</Button>}</div>}
    {message && <p className={styles.status} role="status">{message}</p>}
  </div>;
}
