import Link from "next/link";
import type { ReactNode } from "react";
import { Clock3, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProgressSegment = { mastery: boolean };

/** Full-width lesson top bar: close, lesson identity, authored duration and one segment per step. */
export function LessonTopBar({ eyebrow, title, minutes, segments, current, finished }: {
  eyebrow: string; title: string; minutes: number; segments: ProgressSegment[]; current: number; finished: boolean;
}) {
  const done = finished ? segments.length : current;
  return <header className="border-b border-divider bg-background">
    <div className="mx-auto flex max-w-[1440px] flex-col gap-0.5 px-5 pt-1 pb-2.5 md:gap-1.5 md:px-8 md:pt-0 md:pb-3.5 lg:px-16">
      <div className="flex items-center gap-2.5 md:min-h-16 md:gap-6">
        <Link href="/learn" aria-label="Zavřít lekci" className="-ml-2.5 flex size-11 shrink-0 items-center justify-center rounded-control text-foreground hover:bg-surface-muted md:ml-0 md:w-[180px] md:justify-start md:gap-1.5 md:px-0 md:hover:bg-transparent md:hover:underline md:underline-offset-4">
          <X aria-hidden="true" className="size-5 md:size-4" />
          <span className="hidden text-[15px] font-medium md:inline">Zavřít lekci</span>
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px] md:items-center md:text-center">
          <p className="hidden text-xs font-semibold tracking-[1px] text-muted uppercase md:block">{eyebrow}</p>
          <h1 lang="cs" className="text-sm/[1.286] font-semibold tracking-normal md:text-base/5 [overflow-wrap:anywhere]">{title}</h1>
        </div>
        <p className="flex shrink-0 items-center gap-1 text-[13px] text-muted md:w-[180px] md:justify-end md:gap-1.5 md:text-sm">
          <Clock3 aria-hidden="true" className="size-3.5" /><span className="sr-only">Délka lekce: </span>{minutes} min
        </p>
      </div>
      <div className="flex h-6 items-center gap-2.5 md:h-5">
        <div role="progressbar" aria-label="Postup lekce" aria-valuemin={0} aria-valuemax={segments.length} aria-valuenow={done} aria-valuetext={finished ? "Lekce dokončena" : `Krok ${current + 1} z ${segments.length}`} className="flex flex-1 items-center gap-1">
          {segments.map((segment, index) => <span key={index} className={cn("flex-1 rounded-[3px]", segment.mastery ? "h-1.5" : "h-1", index < done ? "bg-progress" : index === done ? "bg-primary-tint" : "bg-track")} />)}
        </div>
        <span aria-hidden="true" className="shrink-0 text-[13px] font-semibold tabular-nums text-muted">{finished ? segments.length : current + 1} / {segments.length}</span>
      </div>
    </div>
  </header>;
}

/** Sticky bottom bar: quiet Previous on the left, one primary action on the right. */
export function LessonActionBar({ children }: { children: ReactNode }) {
  return <nav aria-label="Navigace kroků lekce" className="sticky bottom-0 z-20 border-t border-divider bg-background">
    <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] md:px-8 md:py-4 lg:px-16">{children}</div>
  </nav>;
}
