import "server-only";

import { instrumentDetailHref } from "@/features/instruments/routes";
import type { MarketDataProviderName } from "@/features/market-data/composition";
import { isMarketDataError } from "@/features/market-data/errors";
import type { MarketDataService } from "@/features/market-data/service";
import type { AuthoredLesson } from "../types";
import { freezeLessonHistory, lessonHistoryPlans, lessonHistoryRequest, unavailableMessage, type LessonHistoryEntry } from "./snapshot";

export const historyFigures = ["historical-period-returns", "historical-cumulative-returns"] as const;

export function lessonUsesHistory(lesson: AuthoredLesson) {
  return lesson.blocks.some((block) => block.type === "interactiveFigure" && (historyFigures as readonly string[]).includes(block.figure));
}

/**
 * Reads the configured provider's fixed lesson window through the normal service, so caching,
 * validation and normalized failures stay in one place. A failure marks that instrument
 * unavailable; the other instrument and the lesson itself keep working.
 */
export async function loadLessonHistory(service: MarketDataService, provider: MarketDataProviderName): Promise<LessonHistoryEntry[]> {
  const plan = lessonHistoryPlans[provider];
  return Promise.all(plan.instruments.map(async (instrument): Promise<LessonHistoryEntry> => {
    try {
      const series = await service.getHistoricalPrices(lessonHistoryRequest(plan, instrument));
      const entry = freezeLessonHistory(series, plan, instrument, instrumentDetailHref(instrument.instrumentId));
      if (entry.status === "unavailable") console.error("[lesson-history] snapshot rejected", { instrumentId: instrument.instrumentId });
      return entry;
    } catch (error) {
      console.error("[lesson-history] history unavailable", { instrumentId: instrument.instrumentId, error: isMarketDataError(error) ? { code: error.code, message: error.message } : error });
      return { status: "unavailable", instrument, message: unavailableMessage };
    }
  }));
}
