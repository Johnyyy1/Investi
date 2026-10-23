import type { EmergencyFundFacts } from "./before-investing/emergency-fund-model";
import type { LessonFigureId } from "./figure-catalog";
import type { MetricId } from "@/features/learning/metric-glossary";
import type { ArtifactRequirement } from "@/features/artifacts/schemas";
import type { FactKey } from "@/features/facts/registry";

export type LessonSection = { id: string; label: string };

type BaseBlock = { id: string };
type GradedBlock = BaseBlock & { prompt: string; correctExplanation: string; incorrectExplanation: string };
export type DocumentRegion = { id: string; label: string; content: string };
export type DecisionNode = { id: string } & ({ prompt: string; choices: { id: string; label: string; nextId: string }[] } | { outcome: string });
export type ExerciseBlock =
  | (GradedBlock & { type: "categorizeQuestion"; categories: { id: string; label: string }[]; items: { id: string; label: string; categoryId: string }[] })
  | (GradedBlock & { type: "orderQuestion"; items: { id: string; label: string }[]; correctOrder: string[] })
  | (GradedBlock & { type: "documentSearchQuestion"; document: { title: string; regions: DocumentRegion[] }; target: { type: "region"; regionId: string } | { type: "numeric"; answer: number; tolerance: number; unit: string } })
  | (GradedBlock & { type: "findErrorQuestion"; steps: { id: string; label: string }[]; incorrectStepId: string });
export type OutputBlock = BaseBlock & (
  | { type: "checklist"; title: string; items: { id: string; label: string }[] }
  | { type: "rubricSelfAssessment"; title: string; prompt: string; criteria: { id: string; label: string; levels: [string, string, string, string] }[] }
);

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
  | ExerciseBlock
  | OutputBlock
  | (BaseBlock & { type: "decisionTree"; title: string; startId: string; nodes: DecisionNode[] })
  | (BaseBlock & { type: "heading"; title: string; body?: string })
  | (BaseBlock & { type: "paragraph"; content: string })
  | (BaseBlock & { type: "formula"; expression: string; latex?: string; variables: { symbol: string; description: string }[] })
  | (BaseBlock & { type: "workedExample"; title: string; introduction?: string; steps: { label: string; value: string; emphasis?: boolean }[]; conclusion: string })
  | (BaseBlock & { type: "conceptCallout"; title: string; content: string })
  | (BaseBlock & { type: "interactiveFigure"; figure: LessonFigureId; title: string; description: string; emergencyFundFacts?: EmergencyFundFacts })
  | (BaseBlock & { type: "multipleChoiceQuestion"; reviewHref?: string; prompt: string; options: ChoiceOption[]; correctOptionId: string; correctExplanation: string; incorrectExplanation: string })
  /** Design F: worked example whose last row the learner completes. Graded like a question. */
  | (BaseBlock & { type: "fadedExample"; title: string; introduction?: string; steps: LabeledValue[]; blank: FadedBlank; misconception?: string; correctExplanation: string; incorrectExplanation: string })
  /** Design H: select the right rows in a fictional document (statement, tariff, KID). Graded like a question. */
  | (BaseBlock & { type: "documentTap"; prompt: string; document: { eyebrow: string; title: string; meta: string; period?: string; columns: DocumentColumn[]; rows: DocumentRow[] }; correctRowIds: string[]; correctExplanation: string; incorrectExplanation: string })
  /** Design I: find the one wrong row of a calculation, then choose its fix. Graded like a question. */
  | (BaseBlock & { type: "findError"; title: string; introduction?: string; rows: (LabeledValue & { id: string; correction?: string })[]; errorRowId: string; fixes: ChoiceOption[]; correctFixId: string; correctExplanation: string; incorrectExplanation: string })
  /** Design J: a trade-off decision for a persona. Not graded: every option reveals its consequence. */
  | (BaseBlock & { type: "personaDecision"; persona: { name: string; age: number; need: string; facts: (LabeledValue & { detail?: string })[] }; note?: { title: string; content: string }; prompt: string; options: { id: string; label: string; consequence: { lead: string; content: string; rows: LabeledValue[] } }[]; disclaimer?: string })
  /** Design K: optional sample exercise; missionId opts into a registered server-verified requirement. Analysis remains sample data. */
  | (BaseBlock & { type: "labMission"; missionId?: string; mission: { title: string; goal: string; minutes: number; steps: string[]; afterReturn: string; target: LabMissionTarget }; analysis: { title: string; summary: string; rows: { label: string; badge?: string; status: string; highlight?: boolean; progress?: number; start?: string; end?: string }[]; generalRule: string; selfExplanationPrompt: string } })
  /** Design L: dated facts used by the lesson, with the educational-content notice. Values come from the fact registry. */
  | (BaseBlock & { type: "factNotice"; factKeys: FactKey[] })
  /** Design M: 2–4 sentences, self-assessed against a rubric, then a sample answer. Never scored and not persisted yet. */
  | (BaseBlock & { type: "writtenReflection"; prompt: string; rubric: { id: string; text: string }[]; sampleAnswer: string })
  | (BaseBlock & { type: "numericQuestion"; reviewHref?: string; prompt: string; answer: number; tolerance: number; unit: string; correctExplanation: string; incorrectExplanation: string })
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
