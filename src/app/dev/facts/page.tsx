import { notFound } from "next/navigation";
import { PageFrame } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";
import { LessonFactNotice } from "@/components/lesson/lesson-fact-notice";
import { factRegistry } from "@/features/facts/registry";
import { prepareLessonFacts } from "@/features/facts/lesson-facts";
import { factReviewState, factToday, formatFactDate, formatFactValue } from "@/features/facts/resolve";
import type { AuthoredLesson } from "@/features/lessons/types";

export const metadata = { title: "Registr faktů · Vývoj", robots: { index: false, follow: false } };

/** Fixed editorial specimen, never registered, graded, saved or rewarded as a lesson. */
const preview: AuthoredLesson = {
  id: "dev-facts-preview", moduleSlug: "dev", slug: "facts", position: 1, estimatedMinutes: 0,
  title: "Náhled datovaného obsahu", eyebrow: "", sections: [],
  factContext: { kind: "tax", asOf: "2026-10-21" },
  blocks: [{ id: "preview", type: "paragraph", content: "Oznamovací hranice osvobozeného příjmu: {{dan.oznameni_5m}}. Povinnost má zákonné podmínky a výjimky." }],
};

export default async function FactsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { date } = await searchParams;
  const today = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : factToday();
  const overdue = factRegistry.filter((fact) => factReviewState(fact, today).overdue);
  const blocked = factRegistry.filter((fact) => fact.verificationStatus === "unverified" || fact.publicationBlockedBy);
  const example = today >= "2026-10-21" ? prepareLessonFacts(preview, factRegistry, { today, published: true }) : null;
  return <PageFrame width="wide" className="py-8 md:py-12">
    <header className="mb-8 flex max-w-prose flex-col gap-3">
      <h1 className="text-page-title font-semibold">Registr faktů</h1>
      <p className="text-secondary">Redakční přehled k {formatFactDate(today)}. {new Set(factRegistry.map((fact) => fact.key)).size} klíčů, {factRegistry.length} datovaných verzí. Neověřená hodnota je podklad k revizi.</p>
      <p className="text-sm text-secondary">Po termínu revize: {overdue.length} verzí · Publikace blokována: {blocked.length} verzí. Údaj může být zastaralý od 60. dne prodlení.</p>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex min-w-0 max-w-full flex-col gap-1 text-sm font-semibold">Datum kontroly<input className="min-h-11 min-w-0 max-w-full rounded-control border border-border bg-surface px-3 font-normal focus-visible:outline-2 focus-visible:outline-primary" type="date" name="date" defaultValue={today} /></label>
        <Button variant="secondary" size="compact" type="submit">Zobrazit datum</Button>
      </form>
    </header>
    <section aria-labelledby="preview-title" className="mb-8 flex max-w-prose flex-col gap-3 rounded-surface bg-surface-muted p-5">
      <h2 id="preview-title" className="text-lg font-semibold">Náhled tokenů · redakční ukázka</h2>
      {example?.notice ? <LessonFactNotice notice={example.notice} /> : null}
      <p>{example ? example.lesson.blocks[0].type === "paragraph" ? example.lesson.blocks[0].content : null : "Náhled nelze ověřit před 21. 10. 2026."}</p>
      <p className="text-sm text-secondary">Pevné datum pravidla: 21. 10. 2026. Datum kontroly výše mění pouze stav revize. Ukázka není publikovaná lekce.</p>
    </section>
    <ul className="divide-y divide-divider border-y border-divider">
      {factRegistry.map((fact) => {
        const review = factReviewState(fact, today);
        const status = fact.verificationStatus === "primary" ? "Primární zdroj ověřen" : fact.verificationStatus === "secondary" ? "Sekundární zdroj ověřen" : "Neověřeno";
        const blocked = fact.verificationStatus === "unverified" || fact.publicationBlockedBy;
        return <li key={`${fact.key}@${fact.version}`} className="py-3">
          <details>
            <summary className="min-h-12 cursor-pointer rounded-control py-2 [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-primary">
              <span className="font-semibold">{fact.label}</span>
              <span className="mt-1 block break-words text-sm text-secondary"><code>{fact.key}</code> · {fact.version} · {status}{blocked ? " · Publikace blokována" : ""}</span>
              <span className={`mt-1 block text-sm ${review.overdue ? "font-semibold text-warning-ink" : "text-secondary"}`}>{review.overdue ? `Po termínu revize (${review.overdueDays} dní)${review.stale ? " · Údaj může být zastaralý" : ""}` : `Revize do ${formatFactDate(fact.nextReviewAt)}`}</span>
            </summary>
            <div className="flex max-w-prose flex-col gap-4 py-4 text-sm/6 [overflow-wrap:anywhere]">
              <p className="text-base font-semibold">{formatFactValue(fact.value)}</p>
              <dl className="grid grid-cols-1 gap-x-5 gap-y-1 sm:grid-cols-[auto_1fr]">
                <dt className="font-semibold">Jurisdikce a období</dt><dd>{fact.jurisdiction} · {fact.period}{fact.taxPeriod ? ` · Zdaňovací období ${fact.taxPeriod}` : ""}</dd>
                <dt className="font-semibold">Platnost</dt><dd>{formatFactDate(fact.validFrom)} – {fact.validTo ? formatFactDate(fact.validTo) : "bez zadaného konce"}</dd>
                <dt className="font-semibold">Právní základ / povaha</dt><dd>{fact.legalBasis}</dd>
                <dt className="font-semibold">Ověření</dt><dd>{fact.verifiedAt ? formatFactDate(fact.verifiedAt) : "Bez úspěšného ověření"} · Kontrola {formatFactDate(fact.checkedAt)}</dd>
                <dt className="font-semibold">Vlastník</dt><dd>{fact.owner}</dd>
                <dt className="font-semibold">Další revize</dt><dd>{formatFactDate(fact.nextReviewAt)}</dd>
              </dl>
              <p>{fact.notes}</p>
              {fact.research ? <p>Vzorek: {fact.research.sample}. Období: {fact.research.period}. Omezení: {fact.research.limitations}</p> : null}
              <ul>{fact.sources.map((source) => <li key={source.url}><a className="inline-flex min-h-11 items-center text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary" href={source.url}>{source.title}</a></li>)}</ul>
              {fact.publicationBlockedBy ? <a className="inline-flex min-h-11 items-center text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary" href={fact.publicationBlockedBy}>Nevyřešená revize blokující publikaci</a> : null}
            </div>
          </details>
        </li>;
      })}
    </ul>
  </PageFrame>;
}
