import { CircleCheck, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ModulePathItem = { id: string; title: string; minutes: number; state: "completed" | "active" | "recommended" | "available" | "locked" };
export function ModulePath({ items, onOpen }: { items: ModulePathItem[]; onOpen: (id: string) => void }) {
  return <ol aria-label="Studijní cesta modulem">{items.map((item, index) => <li key={item.id} className="relative flex gap-4 pb-7 last:pb-0 sm:gap-5" aria-current={item.state === "active" || item.state === "recommended" ? "step" : undefined}>
    {index < items.length - 1 ? <span aria-hidden="true" className="absolute top-10 bottom-0 left-5 w-0.5 bg-border-strong" /> : null}
    <span aria-hidden="true" className={`relative flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-small font-bold ${item.state === "completed" ? "border-primary bg-primary text-primary-foreground" : item.state === "active" || item.state === "recommended" ? "border-primary-hover bg-primary-soft text-primary-hover ring-4 ring-surface" : item.state === "locked" ? "border-border-strong bg-surface-muted text-secondary" : "border-border-strong bg-surface text-secondary"}`}>{item.state === "completed" ? <CircleCheck className="size-5" /> : item.state === "locked" ? <LockKeyhole className="size-4" /> : index + 1}</span>
    <div className="min-w-0 flex-1"><p className="text-body font-bold">{item.title}</p><p className={`mt-1 text-small ${item.state === "completed" ? "font-semibold text-success-ink" : item.state === "active" || item.state === "recommended" ? "font-semibold text-primary-hover" : "text-secondary"}`}>{item.state === "locked" ? "Připravujeme" : item.state === "active" ? "Rozpracováno" : item.state === "recommended" ? "Doporučeno jako další" : item.state === "completed" ? "Dokončeno" : "Připraveno"} · {item.minutes} min</p>
      {item.state !== "locked" ? <Button className="mt-3" variant={item.state === "active" || item.state === "recommended" ? "primary" : "ghost"} onClick={() => onOpen(item.id)}>{item.state === "completed" ? "Zopakovat lekci" : item.state === "active" ? "Pokračovat v lekci" : "Začít lekci"}</Button> : null}
    </div>
  </li>)}</ol>;
}
