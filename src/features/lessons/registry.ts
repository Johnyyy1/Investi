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
import { returnsCheckpointLesson } from "./returns/returns-checkpoint";
import { whatIsCorrelationLesson } from "./correlation/what-is-correlation";
import { notCausationLesson } from "./correlation/not-causation";
import { correlationInCrisesLesson } from "./correlation/correlation-in-crises";
import { correlationRealDataLesson } from "./correlation/correlation-real-data";
import { concentrationLesson } from "./diversification/concentration";
import { sectorsAndCountriesLesson } from "./diversification/sectors-and-countries";
import { etfLookThroughLesson } from "./diversification/etf-look-through";
import { correlationAndRiskLesson } from "./diversification/correlation-and-risk";
import { diversificationScenarioLesson } from "./diversification/diversification-scenario";

import { debtOrInvestLesson } from "./before-investing/debt-or-invest";
import { financialCheckupLesson } from "./before-investing/financial-checkup";
import { budgetLesson } from "./before-investing/budget";
import { goalsAndHorizonLesson } from "./before-investing/goals-and-horizon";

import { emergencyFundLesson } from "./before-investing/emergency-fund";
import { scamsAndFinfluencersLesson } from "./before-investing/scams-and-finfluencers";
import { pensionAndDipLesson } from "./before-investing/pension-and-dip";

export { emergencyFundLesson, pensionAndDipLesson };
/** Placed, unpublished lessons awaiting expert review; never served at their public URL. */
export const draftLessons = [emergencyFundLesson, pensionAndDipLesson, scamsAndFinfluencersLesson] as const;

export const authoredLessons = [financialCheckupLesson, budgetLesson, debtOrInvestLesson, goalsAndHorizonLesson, ...foundationsContent, whatIsAReturnLesson, simpleReturnsLesson, compoundingAndCumulativeReturnsLesson, comparingInvestmentsLesson, logReturnsLesson, returnsCheckpointLesson, whatIsVolatilityLesson, standardDeviationLesson, annualisingVolatilityLesson, maxDrawdownLesson, volatilityCheckpointLesson, whatIsCorrelationLesson, notCausationLesson, correlationInCrisesLesson, correlationRealDataLesson, concentrationLesson, sectorsAndCountriesLesson, etfLookThroughLesson, correlationAndRiskLesson, diversificationScenarioLesson] as const;

export function getAuthoredLesson(moduleSlug: string, lessonSlug: string) {
  return authoredLessons.find((lesson) => lesson.moduleSlug === moduleSlug && lesson.slug === lessonSlug);
}
