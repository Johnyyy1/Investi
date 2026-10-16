import { Flame } from "lucide-react";
export function Streak({ days }: { days: number }) {
  return <span className="inline-flex min-w-0 items-center gap-2 text-small">
    <Flame className="size-5 shrink-0 text-warning-ink" aria-hidden="true" />
    <span className="min-w-0"><span className="block text-microcopy font-semibold text-secondary">Série</span><span className="block font-bold">{days} {days === 1 ? "den" : days >= 2 && days <= 4 ? "dny" : "dní"}</span></span>
  </span>;
}
