"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { missionStatusAction, verifyMissionAction } from "@/features/missions/actions";
import { getMission } from "@/features/missions/registry";
import { DiversificationScenario } from "@/components/lesson/diversification-scenario";

export function VerifiedMission({ missionId, lessonId, onReady, exercise = false }: { missionId: string; lessonId: string; onReady?: (ready: boolean) => void; exercise?: boolean }) {
  const mission = getMission(missionId, lessonId);
  const [completed, setCompleted] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("Misi ověřuje server z uložených dat. Samotné otevření Labu nestačí.");
  useEffect(() => {
    let active = true;
    void missionStatusAction(missionId, lessonId).then((result) => {
      if (!active) return;
      setCompleted(result.completed); onReady?.(result.completed);
      if (result.completed) setMessage("Mise už je ověřená. Další obchod ani pokus není potřeba.");
      else if (result.message) setMessage(result.message);
      if (!result.ok) throw new Error(result.message);
    }).catch(() => { if (active) setMessage("Misi se nepodařilo načíst. Zkus ověření znovu."); });
    return () => { active = false; };
  }, [missionId, lessonId, onReady]);
  async function verify(decision?: unknown, requestId = crypto.randomUUID()) {
    setPending(true);
    try {
      const result = await verifyMissionAction(missionId, lessonId, requestId, decision);
      setCompleted(result.completed); onReady?.(result.completed); setMessage(result.message);
      if (!result.ok) throw new Error(result.message);
    } catch { setMessage("Ověření se nepodařilo uložit. Zkus to znovu."); throw new Error("Mission verification failed"); }
    finally { setPending(false); }
  }
  return <div className="flex min-w-0 flex-col gap-3">
    {exercise && mission.context !== "personal" ? <DiversificationScenario onSubmit={verify} /> : null}
    <p role="status" className="text-sm text-secondary">{completed ? "Splněno · " : ""}{message}</p>
    {!exercise && mission.context !== "personal" ? <ButtonLink href={`/lab/missions/${mission.id}`} target="_blank" rel="noopener">Otevřít oddělené cvičení<span className="sr-only"> (v nové kartě)</span></ButtonLink> : null}
    {mission.context === "personal" ? <Button variant="secondary" loading={pending} onClick={() => void verify().catch(() => {})}>Ověřit misi</Button> : !exercise ? <Button variant="secondary" loading={pending} onClick={() => { setPending(true); void missionStatusAction(missionId, lessonId).then((result) => { setCompleted(result.completed); onReady?.(result.completed); setMessage(result.message ?? (result.completed ? "Server potvrdil splnění mise." : "Zatím chybí ověřený výsledek odděleného cvičení.")); }).catch(() => setMessage("Ověření se nepodařilo načíst. Zkus to znovu.")).finally(() => setPending(false)); }}>Ověřit výsledek cvičení</Button> : null}
    {!completed && mission.context === "personal" ? <div className="flex flex-wrap gap-3"><ButtonLink href="/lab/plan" variant="ghost">Otevřít IPS</ButtonLink><ButtonLink href="/learn" variant="ghost">Zpět k učení</ButtonLink></div> : null}
  </div>;
}
