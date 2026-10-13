import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { availableLessons } from "@/features/learning/catalog";
import { getLearnerSummary, type LearnerState } from "@/features/learning/learner-summary";
import { getAuthoredLesson } from "@/features/lessons/registry";
import { getGuidedSteps } from "@/features/lessons/returns/guided-flow";
import type { PortfolioLedgerSummary } from "@/features/portfolio/ledger-summary";
import { evaluateUnlock, PORTFOLIO_LAB_UNLOCK_ID } from "@/features/progression/unlocks";
import ProgressError from "@/app/(app)/progress/error";
import ProgressLoading from "@/app/(app)/progress/loading";
import { firstSentence, progressModel } from "./progress-model";
import { ProgressOverview } from "./progress-overview";

const day = (date: number) => new Date(Date.UTC(2026, 8, date, 10));
const done = (lessonId: string, completedAt = day(1)): LearnerState => ({ lessonId, status: "completed", lastPosition: 0, completedAt, updatedAt: completedAt });
const started = (lessonId: string, lastPosition: number): LearnerState => ({ lessonId, status: "in_progress", lastPosition, completedAt: null, updatedAt: day(20) });
const foundations = availableLessons.filter((lesson) => lesson.moduleSlug === "investing-foundations");
const returns = availableLessons.filter((lesson) => lesson.moduleSlug === "returns");

function learner(states: LearnerState[] = [], earned = 0n) {
  return { user: { name: "Jana Nováková" }, gamification: { totalXp: 0, timeZone: "Europe/Prague" }, practiceCapital: { earnedPracticeCapitalMinor: earned }, ...getLearnerSummary(states), states };
}
/** XP mirrors the receipts of published completions; an explicit `portfolio: undefined` means the ledger failed. */
function render(states: LearnerState[] = [], options: { earned?: bigint; portfolio?: PortfolioLedgerSummary | null } = {}) {
  const summary = learner(states, options.earned);
  const unlock = evaluateUnlock(PORTFOLIO_LAB_UNLOCK_ID, { totalXp: summary.completed.length * 60, completedLessonIds: new Set(summary.completed.map((lesson) => lesson.id)) });
  return renderToStaticMarkup(createElement(ProgressOverview, { summary, unlock, portfolio: "portfolio" in options ? options.portfolio : null }));
}
const ledger: PortfolioLedgerSummary = { openedAt: "2026-09-08T08:00:00.000Z", earnedPracticeCapitalMinor: "500000", availableCashMinor: "12345678", holdingsCount: 3, tradeCount: 4, lastTrade: { side: "BUY", symbol: "VWCE", executedAt: "2026-09-10T08:00:00.000Z" } };
const count = (html: string, text: string) => html.split(text).length - 1;

describe("Progress presentation model", () => {
  it("shows an honest empty shelf with the real first lesson and no guide or invented numbers", () => {
    const html = render();
    expect(progressModel(learner()).knowledge).toEqual([]);
    expect(html).toContain("Tvoje police je zatím prázdná.");
    expect(html).toContain("0 z 12 lekcí");
    expect(html).toContain("0 XP");
    expect(html).toContain('href="/learn/investing-foundations/why-invest"');
    expect(html).toContain("Začít první lekci");
    expect(html).not.toContain("18-bookshelf");
    expect(html).not.toContain("total-practice-capital");
    expect(html).toContain("Zatím zamčený");
  });

  it("keeps a started first lesson out of the shelf and resumes its saved step", () => {
    const html = render([started(foundations[0].id, 2)]);
    expect(html).toContain("První lekci máš rozdělanou.");
    expect(html).toContain("Pokračovat od kroku 3");
    expect(html).toContain("0 z 12 lekcí");
  });

  it("derives the shelf from completed published lessons and their authored step", () => {
    const states = [done(foundations[0].id, day(1)), done(foundations[1].id, day(2)), done(foundations[2].id, day(3)), done("retired-lesson"), started("foundations-markets", 2)];
    const model = progressModel(learner(states));
    expect(model.knowledge.map((lesson) => lesson.id)).toEqual(foundations.slice(0, 3).map((lesson) => lesson.id));
    for (const lesson of model.knowledge) {
      const authored = getAuthoredLesson("investing-foundations", availableLessons.find((item) => item.id === lesson.id)!.slug)!;
      const steps = getGuidedSteps(authored);
      expect(lesson.ideas.length).toBeGreaterThan(0);
      for (const idea of lesson.ideas) {
        const block = steps[idea.step - 1].blocks.find((item) => item.id === idea.id);
        expect(block && "content" in block && (block.content.startsWith(idea.text) || block.content.startsWith(idea.title)) && block.content.includes(idea.text)).toBe(true);
        expect(idea.title).not.toMatch(/^Shrnutí/);
      }
    }
    expect(model.chapters[0].lessons.map((lesson) => lesson.status)).toEqual(["done", "done", "done", "todo", "active", "todo", "todo"]);
    expect(model.chapters[0].status).toBe("started");
    expect(model.milestone).toBeUndefined();
    const html = render(states);
    expect(html).toContain("Co už umíš, Jana.");
    expect(html).toContain("Tři lekce hotové, jedna rozdělaná.");
    expect(html).toContain("3 z 12 lekcí");
    expect(html).toContain("180 XP");
    expect(html).toContain("ze 3 lekcí");
    expect(html).toContain("Pokračovat od kroku 3");
    expect(html).toMatch(/krok 3\u00a0z\u00a08/);
    expect(count(html, 'aria-current="step"')).toBe(1);
    expect(html).toContain("3 / 7");
    expect(html).toContain("Rozpracováno");
    expect(html).not.toContain("retired-lesson");
  });

  it("keeps the three most recent completions on the shelf and the rest behind a disclosure", () => {
    const states = [done(foundations[0].id, day(5)), done(foundations[1].id, day(1)), done(foundations[2].id, day(4)), done(returns[0].id, day(2)), done(returns[1].id, day(3))];
    const model = progressModel(learner(states));
    expect(model.featured.map((lesson) => lesson.id)).toEqual([returns[1].id, foundations[2].id, foundations[0].id]);
    expect(model.shelved.map((lesson) => lesson.id)).toEqual([foundations[1].id, returns[0].id]);
    expect(render(states)).toContain("Další hotové lekce (2)");
  });

  it("marks a finished chapter as a calm milestone that hands over to the next one", () => {
    const states = foundations.map((lesson, index) => done(lesson.id, day(index + 1)));
    const model = progressModel(learner(states));
    expect(model.milestone?.chapter.slug).toBe("investing-foundations");
    expect(model.milestone?.nextChapter.slug).toBe("returns");
    expect(model.milestone?.completedAt).toEqual(day(7));
    const html = render(states, { portfolio: ledger });
    expect(html).toContain("Kapitola 01 hotová");
    expect(html).toContain("Základy investování máš za sebou.");
    expect(html).toContain("Co ti to otevírá");
    expect(html).toContain("jak poznat, jestli se investici daří?");
    expect(html).toContain('href="/learn/returns/what-is-a-return"');
    expect(html).toContain("Začít lekcí Co je výnos?");
    expect(html).toContain("7 z 12 lekcí");
    expect(html).toContain("420 XP");
    expect(html).not.toContain("ročním nákladům fondu");
    // Starting the next chapter ends the milestone.
    expect(progressModel(learner([...states, started(returns[0].id, 1)])).milestone).toBeUndefined();
  });

  it("derives a milestone for chapters without editorial copy from their real lessons", () => {
    const states = returns.map((lesson) => done(lesson.id));
    const html = render(states);
    expect(progressModel(learner(states)).milestone?.chapter.slug).toBe("returns");
    expect(html).toContain("Co kapitola probrala");
    expect(html).toContain("Výnosy máš za sebou.");
    expect(html).toContain("Začít lekcí Spoření vs. investování");
    expect(html).not.toContain("jak poznat, jestli se investici daří?");
  });

  it("shows all-complete progress, receipt-derived capital and only the planned chapter as upcoming", () => {
    const states = availableLessons.map((lesson) => done(lesson.id));
    const model = progressModel(learner(states));
    expect(model.milestone).toBeUndefined();
    expect(model.continueHref).toBe("/lab");
    expect(model.knowledge).toHaveLength(12);
    expect(model.planned).toEqual({ number: "03", title: "Riziko", topics: ["Volatilita", "Korelace", "Diverzifikace"] });
    const html = render(states, { earned: 123_456n, portfolio: ledger });
    expect(html).toContain("Všechno, co zatím je, máš za sebou.");
    expect(html).toContain("Prozkoumat Lab");
    expect(html).toContain('href="/lab"');
    expect(html).toMatch(/1\s234,56\sKč/);
    expect(html).toContain("Připravujeme");
    expect(html).not.toContain("Následuje");
    expect(html).not.toContain('aria-current="step"');
  });

  it("reads the Lab card from the saved ledger only and never turns missing data into zero", () => {
    const states = foundations.map((lesson) => done(lesson.id));
    const unlocked = render(states, { earned: 500_000n, portfolio: ledger });
    expect(unlocked).toContain("3 pozice v portfoliu");
    expect(unlocked).toContain("nákup VWCE");
    expect(unlocked).toContain("123 456,78 Kč");
    expect(unlocked).toMatch(/data-testid="total-practice-capital">5\s000\sKč/);
    expect(unlocked).toContain("Hodnotu podle aktuálních cen ukazuje Lab.");
    const failed = render(states, { earned: 500_000n, portfolio: undefined });
    expect(failed).toContain("Uložené údaje se nenačetly");
    expect(failed).not.toContain("total-practice-capital");
    expect(failed).not.toMatch(/>0\s?Kč/);
    const xpWithoutPrerequisites = render([...foundations.slice(0, 3), ...returns.slice(0, 4)].map((lesson) => done(lesson.id)));
    expect(xpWithoutPrerequisites).toContain("Zatím zamčený");
    expect(xpWithoutPrerequisites).toContain("3 / 7");
    expect(xpWithoutPrerequisites).toContain("420 / 420 XP");
    expect(xpWithoutPrerequisites).toContain("Odemkne se po dokončení všech lekcí Základů investování.");
  });

  it("connects the latest finished lesson to practice with its authored Lab bridge", () => {
    const html = render([done(foundations[0].id, day(1)), done(foundations[1].id, day(2))]);
    const bridge = getAuthoredLesson("investing-foundations", foundations[1].slug)!.blocks.find((block) => block.type === "labBridge");
    expect(bridge && "content" in bridge && html.includes(bridge.content)).toBe(true);
    expect(html).toContain(`Z lekce ${foundations[1].title}`);
  });

  it("cuts authored text at the first sentence without splitting decimals", () => {
    expect(firstSentence("0,05 znamená 5 %. Stejně tak −0,12 znamená −12 %.")).toBe("0,05 znamená 5 %.");
    expect(firstSentence("Jedna věta bez tečky")).toBe("Jedna věta bez tečky");
    expect(firstSentence("Při splitu 2 : 1 se akcie změní. Celková hodnota zůstane.")).toBe("Při splitu 2 : 1 se akcie změní.");
  });

  it("keeps loading and failure states free of counts, balances and technical detail", () => {
    const html = renderToStaticMarkup(createElement(ProgressError, { retry: () => {}, error: new Error("private database detail") }));
    expect(html).toContain("Načíst znovu");
    expect(html).toContain('role="alert"');
    expect(html).toContain("20-searching-box");
    expect(html).not.toMatch(/private database|\d+ XP|z 12|Kč/);
    const loading = renderToStaticMarkup(createElement(ProgressLoading));
    expect(loading).toContain('aria-busy="true"');
    expect(loading).not.toMatch(/\d+ XP|z 12|Kč/);
  });
});
