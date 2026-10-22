import type { MetricId } from "@/features/learning/metric-glossary";
import type { ArtifactRequirement } from "@/features/artifacts/schemas";
import type { FactKey } from "@/features/facts/registry";

export type LessonSection = { id: string; label: string };

type BaseBlock = { id: string };

/**
 * A choice. `explanation` replaces the shared incorrect explanation when this wrong option is chosen;
 * `misconception` is the short "Častá záměna" label naming the mistaken idea (design G).
 */
export type ChoiceOption = { id: string; label: string; explanation?: string; misconception?: string };
type LabeledValue = { label: string; value: string };

/** The one blank row a learner completes in a faded worked example (design F). */
export type FadedBlank = { label: string } & (
  | { input: "choice"; options: ChoiceOption[]; correctOptionId: string }
  | { input: "number"; answer: number; tolerance: number; unit: string }
);

/** A column of a fictional document. On mobile only columns with a role are shown, stacked into one row card (design H). */
export type DocumentColumn = { id: string; label: string; align?: "start" | "end"; mobile?: "title" | "subtitle" | "value" | "detail"; mobileLabel?: string };
/** `note` explains the row once evaluated ("osvobození od 15. 1. 2024"); the status prefix is derived from the answer. */
export type DocumentRow = { id: string; cells: Record<string, string>; selectable?: boolean; note: string };

/** Existing Lab routes a lesson mission may open. A mission never points at planned functionality. */
export type LabMissionTarget = "/lab/portfolio" | "/lab/backtesting" | "/lab/compare";

export type LessonBlock =
  | (BaseBlock & { type: "heading"; title: string; body?: string })
  | (BaseBlock & { type: "paragraph"; content: string })
  | (BaseBlock & { type: "formula"; expression: string; latex?: string; variables: { symbol: string; description: string }[] })
  | (BaseBlock & { type: "workedExample"; title: string; introduction?: string; steps: { label: string; value: string; emphasis?: boolean }[]; conclusion: string })
  | (BaseBlock & { type: "conceptCallout"; title: string; content: string })
  | (BaseBlock & { type: "interactiveFigure"; figure: "return-calculator" | "price-series-explorer" | "historical-period-returns" | "historical-cumulative-returns" | "historical-volatility" | "historical-drawdown" | "volatility-paths" | "standard-deviation-explorer" | "annualisation-explorer" | "max-drawdown-explorer" | "correlation-explorer" | "common-factor-explorer" | "crisis-correlation-explorer" | "historical-correlation" | "concentration-explorer" | "exposure-explorer" | "look-through-explorer" | "portfolio-correlation-explorer" | "diversification-scenario" | "compounding-explorer" | "recovery-explorer" | "growth-comparison" | "ownership-explorer" | "market-cap-explorer" | "stock-position-explorer" | "index-etf-visual" | "etf-holdings-visual" | "bond-cashflow-explorer" | "asset-comparison" | "market-quote-explorer" | "liquidity-comparison" | "risk-scenario-explorer" | "drawdown-explorer" | "diversification-preview" | "time-horizon-explorer" | "portfolio-builder" | "diversification-impact" | "portfolio-horizon-scenario" | "risk-capacity-scenario"; title: string; description: string })
  | (BaseBlock & { type: "multipleChoiceQuestion"; prompt: string; options: ChoiceOption[]; correctOptionId: string; correctExplanation: string; incorrectExplanation: string })
  /** Design F: worked example whose last row the learner completes. Graded like a question. */
  | (BaseBlock & { type: "fadedExample"; title: string; introduction?: string; steps: LabeledValue[]; blank: FadedBlank; misconception?: string; correctExplanation: string; incorrectExplanation: string })
  /** Design H: select the right rows in a fictional document (statement, tariff, KID). Graded like a question. */
  | (BaseBlock & { type: "documentTap"; prompt: string; document: { eyebrow: string; title: string; meta: string; period?: string; columns: DocumentColumn[]; rows: DocumentRow[] }; correctRowIds: string[]; correctExplanation: string; incorrectExplanation: string })
  /** Design I: find the one wrong row of a calculation, then choose its fix. Graded like a question. */
  | (BaseBlock & { type: "findError"; title: string; introduction?: string; rows: (LabeledValue & { id: string; correction?: string })[]; errorRowId: string; fixes: ChoiceOption[]; correctFixId: string; correctExplanation: string; incorrectExplanation: string })
  /** Design J: a trade-off decision for a persona. Not graded: every option reveals its consequence. */
  | (BaseBlock & { type: "personaDecision"; persona: { name: string; age: number; need: string; facts: (LabeledValue & { detail?: string })[] }; note?: { title: string; content: string }; prompt: string; options: { id: string; label: string; consequence: { lead: string; content: string; rows: LabeledValue[] } }[]; disclaimer?: string })
  /** Design K: optional mission in an existing Lab area, then an analysis. Without Lab data the analysis is labelled sample data. */
  | (BaseBlock & { type: "labMission"; mission: { title: string; goal: string; minutes: number; steps: string[]; afterReturn: string; target: LabMissionTarget }; analysis: { title: string; summary: string; rows: { label: string; badge?: string; status: string; highlight?: boolean; progress?: number; start?: string; end?: string }[]; generalRule: string; selfExplanationPrompt: string } })
  /** Design L: dated facts used by the lesson, with the educational-content notice. Values come from the fact registry. */
  | (BaseBlock & { type: "factNotice"; factKeys: FactKey[] })
  /** Design M: 2–4 sentences, self-assessed against a rubric, then a sample answer. Never scored and not persisted yet. */
  | (BaseBlock & { type: "writtenReflection"; prompt: string; rubric: { id: string; text: string }[]; sampleAnswer: string })
  | (BaseBlock & { type: "numericQuestion"; prompt: string; answer: number; tolerance: number; unit: string; correctExplanation: string; incorrectExplanation: string })
  | (BaseBlock & { type: "multiNumericQuestion"; prompt: string; answers: { id: string; label: string; answer: number; tolerance: number; unit: string }[]; correctExplanation: string; incorrectExplanation: string })
  | (BaseBlock & { type: "explanation"; title: string; content: string })
  | (BaseBlock & { type: "takeaway"; title: string; content: string })
  /** `metric` adds a „Vyzkoušej v Labu“ link to that metric, on the lesson's own instrument when it has one. */
  | (BaseBlock & { type: "labBridge"; title: string; content: string; metric?: MetricId })
  | (BaseBlock & { type: "lessonSummary"; title: string; content: string })
  | (BaseBlock & { type: "checkpoint"; label: string; content: string });

/** One guided step: a title and the IDs of the authored blocks it shows, in order. */
export type StepDefinition = { title: string; kind?: "lesson" | "mastery"; blocks: readonly string[]; requiredArtifact?: ArtifactRequirement };

export type AuthoredLesson = {
  id: string;
  moduleSlug: string;
  slug: string;
  title: string;
  eyebrow: string;
  position: number;
  estimatedMinutes: number;
  /** Fixed applicability date for a historical/scenario lesson; omitted means today's rules. */
  factContext?: { asOf?: string; kind?: "tax" | "regulatory" | "research" };
  sections: LessonSection[];
  navigation?: { previous?: { href: string; label: string }; next?: { href: string; label: string } };
  blocks: LessonBlock[];
};
