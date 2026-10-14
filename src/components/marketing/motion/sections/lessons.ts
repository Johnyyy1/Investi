import { armCompactDemo, prepareCompactDemo } from "./lesson-demo";
import type { SectionInit } from "../types";

/** "Krátké lekce": heading/copy use the shared reveals; the preview replays "mistake → explanation → right answer". */
export const initLessons: SectionInit = ctx => {
  const card = prepareCompactDemo(ctx);
  if (card) armCompactDemo(ctx, card);
};
