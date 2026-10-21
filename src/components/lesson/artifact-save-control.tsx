"use client";

import { useId, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { saveArtifact } from "@/features/artifacts/actions";
import type { ArtifactContent, LearnerArtifact } from "@/features/artifacts/schemas";
import { artifactConsentText } from "@/features/artifacts/presentation";

/** Lesson editors supply typed minimal content; saving is always a separate, explicit decision. */
export function ArtifactSaveControl({ content, sourceLessonId, guest = false, onSaved }: {
  content: ArtifactContent; sourceLessonId: string | null; guest?: boolean; onSaved?: (artifact: LearnerArtifact) => void;
}) {
  const id = useId();
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const request = useRef<{ content: string; id: string } | null>(null);
  const lock = useRef(false);

  async function save() {
    if (!consent || lock.current) return;
    lock.current = true; setPending(true); setMessage(undefined);
    const serialized = JSON.stringify({ content, sourceLessonId });
    if (request.current?.content !== serialized) request.current = { content: serialized, id: crypto.randomUUID() };
    try {
      const result = await saveArtifact({ content, sourceLessonId, consent, requestId: request.current.id });
      if (result.ok) {
        setMessage({ ok: true, text: `Výstup je uložený. Verze ${result.artifact.version}.` });
        onSaved?.(result.artifact);
      } else setMessage({ ok: false, text: result.message });
    } catch { setMessage({ ok: false, text: "Připojení se nepodařilo. Výstup zůstává na této stránce. Zkus uložení znovu." }); }
    finally { lock.current = false; setPending(false); }
  }

  if (guest) return <div className="space-y-3 text-sm/6 text-muted"><p>Výstupy hosta neukládáme. Pro navazující lekce si nejdřív ulož účet.</p><ButtonLink href="/onboarding/save" variant="secondary">Uložit účet</ButtonLink></div>;
  return <div className="space-y-4">
    <label htmlFor={id} className="flex min-h-12 items-start gap-3 text-sm/6 text-foreground">
      <input id={id} type="checkbox" className="mt-1 size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground" checked={consent} disabled={pending} onChange={(event) => setConsent(event.target.checked)} />
      <span>{artifactConsentText}</span>
    </label>
    <Button variant="secondary" disabled={!consent} loading={pending} onClick={() => void save()}>{pending ? "Ukládám výstup…" : "Uložit výstup"}</Button>
    {message && <p className={message.ok ? "text-sm text-primary" : "text-sm text-danger"} role={message.ok ? "status" : "alert"}>{message.text}</p>}
  </div>;
}
