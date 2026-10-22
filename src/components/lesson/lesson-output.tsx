"use client";

import { useEffect, useState } from "react";
import { Select, Textarea } from "@/components/ui/form-controls";
import { listArtifacts } from "@/features/artifacts/actions";
import type { ArtifactPayload } from "@/features/artifacts/schemas";
import type { OutputBlock } from "@/features/lessons/types";
import { validOutputForBlock } from "@/features/lessons/output-contract";
import { ArtifactSaveControl } from "./artifact-save-control";

export function LessonOutput({ block, lessonId, guest = false, onReady }: {
  block: OutputBlock; lessonId: string; guest?: boolean; onReady?: (blockId: string, ready: boolean) => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string>();
  const [loading, setLoading] = useState(!guest);
  const [loadError, setLoadError] = useState(false);
  const payload: ArtifactPayload<"lesson_output"> = block.type === "checklist"
    ? { type: block.type, blockId: block.id, checkedItemIds: checked }
    : { type: block.type, blockId: block.id, text: text.trim(), ratings: block.criteria.filter((criterion) => ratings[criterion.id]).map((criterion) => ({ criterionId: criterion.id, level: Number(ratings[criterion.id]) })) };
  const serialized = JSON.stringify(payload);
  const ready = saved === serialized;
  useEffect(() => { onReady?.(block.id, ready); }, [block.id, ready, onReady]);
  useEffect(() => {
    if (guest) return;
    let active = true;
    void listArtifacts({ kind: "lesson_output" }).then((result) => {
      if (!active) return;
      if (!result.ok) { setLoadError(true); return; }
      const artifact = result.artifacts.find((item) => item.kind === "lesson_output" && item.sourceLessonId === lessonId && item.payload.blockId === block.id);
      if (artifact?.kind !== "lesson_output" || !validOutputForBlock(block, artifact.payload)) return;
      const stored = artifact.payload;
      if (stored.type === "checklist") setChecked(stored.checkedItemIds);
      else { setText(stored.text); setRatings(Object.fromEntries(stored.ratings.map((rating) => [rating.criterionId, String(rating.level)]))); }
      setSaved(JSON.stringify(stored));
    }).catch(() => { if (active) setLoadError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [block, guest, lessonId]);
  const valid = payload.type === "checklist" || (payload.text.trim().length > 0 && validOutputForBlock(block, payload));
  return <section aria-labelledby={`${block.id}-output`} className="space-y-5 break-words rounded-surface border border-border bg-surface p-5 md:p-7" aria-busy={loading}>
    <h3 id={`${block.id}-output`} className="text-xl font-semibold">{block.title}</h3>
    <p className="text-sm text-secondary">{block.type === "checklist" ? "Checklist nemá správné a špatné odpovědi. Ulož si i rozpracovaný seznam." : "Napiš svůj výstup a posuď ho podle popsaných úrovní. Pokračování závisí na odevzdání, ne na zvolené úrovni."}</p>
    {loadError && <p role="alert" className="text-sm text-danger">Uložený výstup se nepodařilo načíst. Před novým uložením můžeš stránku obnovit.</p>}
    {loading ? <p role="status">Načítám uložený výstup…</p> : <>
      {block.type === "checklist" ? <fieldset className="min-w-0 space-y-3"><legend className="sr-only">Položky checklistu</legend>{block.items.map((item) => <label key={item.id} className="flex min-h-12 items-center gap-3 text-base"><input type="checkbox" checked={checked.includes(item.id)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} className="size-5 shrink-0 accent-primary" /><span className="min-w-0 flex-1">{item.label}</span></label>)}</fieldset> : <>
        <label className="flex flex-col gap-2 text-base"><span>{block.prompt}</span><Textarea value={text} maxLength={2000} onChange={(event) => setText(event.target.value)} /></label>
        {block.criteria.map((criterion) => <div key={criterion.id} className="space-y-3 border-t border-divider pt-4">
          <h4 className="font-semibold">{criterion.label}</h4><ol className="list-decimal space-y-2 pl-5 text-sm text-secondary">{criterion.levels.map((level, index) => <li key={index}>{level}</li>)}</ol>
          <label className="flex flex-col gap-2"><span className="text-sm">Moje úroveň: {criterion.label}</span><Select value={ratings[criterion.id] ?? ""} onChange={(event) => setRatings((current) => ({ ...current, [criterion.id]: event.target.value }))}><option value="">Vyber úroveň</option>{criterion.levels.map((_, index) => <option key={index} value={index + 1}>{index + 1}. úroveň</option>)}</Select></label>
        </div>)}
      </>}
      {valid ? <ArtifactSaveControl content={{ kind: "lesson_output", payload }} sourceLessonId={lessonId} guest={guest} onSaved={(artifact) => { if (artifact.kind === "lesson_output") setSaved(JSON.stringify(artifact.payload)); }} /> : <p className="text-sm text-secondary">Pro odevzdání napiš výstup a zvol úroveň u každého kritéria.</p>}
      <p role="status" className="text-sm text-primary">{ready ? "Aktuální výstup je uložený." : saved ? "Výstup obsahuje neuložené změny." : ""}</p>
    </>}
  </section>;
}
