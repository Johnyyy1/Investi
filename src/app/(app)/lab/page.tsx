import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { lessonProgress } from "@/db/schema";
import { LabHub } from "@/components/lab/lab-hub";
import { loadPortfolioView } from "@/features/portfolio/service";
import { loadPortfolioLabUnlockStatus } from "@/features/progression/repository";
import { getCurrentUser } from "@/lib/session";
import { perfMeasure, perfSegment } from "@/lib/perf";

export const metadata = { title: "Lab" };

export default function LabPage() {
  return perfSegment("page:/lab", renderLabPage);
}

async function renderLabPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const [unlock, completed] = await Promise.all([
    loadPortfolioLabUnlockStatus(user.id),
    perfMeasure("lab.completedLessons", "db", () => db.select({ lessonId: lessonProgress.lessonId }).from(lessonProgress).where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.status, "completed")))),
  ]);
  // The valuation waits on quotes, so it streams into its card instead of holding the page.
  // A failure becomes the card's own error state rather than an unhandled rejection.
  const view = unlock.unlocked ? perfMeasure("portfolio.loadPortfolioView", "compute", () => loadPortfolioView(user.id)).catch(() => null) : null;
  return <LabHub unlock={unlock} completedLessonIds={new Set(completed.map(({ lessonId }) => lessonId))} view={view} />;
}
