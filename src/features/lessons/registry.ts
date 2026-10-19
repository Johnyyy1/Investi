import { whatIsAReturnLesson } from "./returns/what-is-a-return";
import { simpleReturnsLesson } from "./returns/simple-returns";
import { compoundingAndCumulativeReturnsLesson } from "./returns/compounding-and-cumulative-returns";

import { comparingInvestmentsLesson } from "./returns/comparing-investments";

import { logReturnsLesson } from "./returns/log-returns";

import { foundationsContent } from "./foundations/content";
import { whatIsVolatilityLesson } from "./volatility/what-is-volatility";
import { standardDeviationLesson } from "./volatility/standard-deviation";
import { annualisingVolatilityLesson } from "./volatility/annualising-volatility";
import { maxDrawdownLesson } from "./volatility/max-drawdown";
import { volatilityCheckpointLesson } from "./volatility/volatility-checkpoint";

export const authoredLessons = [...foundationsContent, whatIsAReturnLesson, simpleReturnsLesson, compoundingAndCumulativeReturnsLesson, comparingInvestmentsLesson, logReturnsLesson, whatIsVolatilityLesson, standardDeviationLesson, annualisingVolatilityLesson, maxDrawdownLesson, volatilityCheckpointLesson] as const;

export function getAuthoredLesson(moduleSlug: string, lessonSlug: string) {
  return authoredLessons.find((lesson) => lesson.moduleSlug === moduleSlug && lesson.slug === lessonSlug);
}
