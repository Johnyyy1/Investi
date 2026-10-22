import { formatFactDate } from "@/features/facts/resolve";
import type { LessonFactNotice as Notice } from "@/features/facts/types";

export function LessonFactNotice({ notice }: { notice: Notice }) {
  return <aside aria-label="Platnost vzdělávacího obsahu" className="flex flex-col gap-2 text-sm/6 text-secondary">
    <p>Vzdělávací obsah, ne daňové ani investiční poradenství · stav k <time dateTime={notice.verifiedAt}>{formatFactDate(notice.verifiedAt)}</time></p>
    {notice.staleFacts.length ? <p role="status" className="rounded-control bg-warning-soft px-4 py-3 text-warning-ink">Údaj může být zastaralý: {notice.staleFacts.join(", ")}. Před rozhodnutím ověř aktuální pravidla v primárním zdroji.</p> : null}
  </aside>;
}
