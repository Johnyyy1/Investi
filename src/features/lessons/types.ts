import type { MetricId } from "@/features/learning/metric-glossary";

export type LessonSection = { id: string; label: string };

type BaseBlock = { id: string };

export type LessonBlock =
  | (BaseBlock & { type: "heading"; title: string; body?: string })
  | (BaseBlock & { type: "paragraph"; content: string })
  | (BaseBlock & { type: "formula"; expression: string; latex?: string; variables: { symbol: string; description: string }[] })
  | (BaseBlock & { type: "workedExample"; title: string; introduction?: string; steps: { label: string; value: string; emphasis?: boolean }[]; conclusion: string })
  | (BaseBlock & { type: "conceptCallout"; title: string; content: string })
  | (BaseBlock & { type: "interactiveFigure"; figure: "return-calculator" | "price-series-explorer" | "historical-period-returns" | "historical-cumulative-returns" | "historical-volatility" | "historical-drawdown" | "volatility-paths" | "standard-deviation-explorer" | "annualisation-explorer" | "max-drawdown-explorer" | "correlation-explorer" | "common-factor-explorer" | "crisis-correlation-explorer" | "historical-correlation" | "concentration-explorer" | "exposure-explorer" | "look-through-explorer" | "portfolio-correlation-explorer" | "diversification-scenario" | "compounding-explorer" | "recovery-explorer" | "growth-comparison" | "ownership-explorer" | "market-cap-explorer" | "stock-position-explorer" | "index-etf-visual" | "etf-holdings-visual" | "bond-cashflow-explorer" | "asset-comparison" | "market-quote-explorer" | "liquidity-comparison" | "risk-scenario-explorer" | "drawdown-explorer" | "diversification-preview" | "time-horizon-explorer" | "portfolio-builder" | "diversification-impact" | "portfolio-horizon-scenario" | "risk-capacity-scenario"; title: string; description: string })
  | (BaseBlock & { type: "multipleChoiceQuestion"; prompt: string; options: { id: string; label: string }[]; correctOptionId: string; correctExplanation: string; incorrectExplanation: string })
  | (BaseBlock & { type: "numericQuestion"; prompt: string; answer: number; tolerance: number; unit: string; correctExplanation: string; incorrectExplanation: string })
  | (BaseBlock & { type: "multiNumericQuestion"; prompt: string; answers: { id: string; label: string; answer: number; tolerance: number; unit: string }[]; correctExplanation: string; incorrectExplanation: string })
  | (BaseBlock & { type: "explanation"; title: string; content: string })
  | (BaseBlock & { type: "takeaway"; title: string; content: string })
  /** `metric` adds a „Vyzkoušej v Labu“ link to that metric, on the lesson's own instrument when it has one. */
  | (BaseBlock & { type: "labBridge"; title: string; content: string; metric?: MetricId })
  | (BaseBlock & { type: "lessonSummary"; title: string; content: string })
  | (BaseBlock & { type: "checkpoint"; label: string; content: string });

/** One guided step: a title and the IDs of the authored blocks it shows, in order. */
export type StepDefinition = { title: string; kind?: "lesson" | "mastery"; blocks: readonly string[] };

export type AuthoredLesson = {
  id: string;
  moduleSlug: string;
  slug: string;
  title: string;
  eyebrow: string;
  position: number;
  estimatedMinutes: number;
  sections: LessonSection[];
  navigation?: { previous?: { href: string; label: string }; next?: { href: string; label: string } };
  blocks: LessonBlock[];
};
