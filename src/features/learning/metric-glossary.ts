import { curriculumLessons } from "./catalog";

/**
 * One source of truth for the analytical metrics the Labs show: name, short explanation,
 * formula, per-Lab conventions and the lesson that teaches the metric. The instrument detail,
 * the comparison, the Backtesting Lab and Portfolio Lab render from here, and lessons link back.
 */
export type MetricId = "simple-return" | "cumulative-return" | "annualised-return" | "max-drawdown" | "volatility" | "sharpe-ratio" | "correlation";

/** Where a metric is computed. Each place uses its own data frequency, so conventions differ. */
export type MetricContext = "instrument" | "backtest";

export type MetricGlossaryEntry = {
  id: MetricId;
  name: string;
  /** Shorter label where space is tight, e.g. a backtest row. */
  shortName?: string;
  summary: string;
  /** KaTeX source; the Labs render it on the server only. Keep it breakable at top level (no \left…\right) so it wraps at 320 px. */
  formula: string;
  conventions: Partial<Record<MetricContext, string>>;
  /** Authored, available lesson that teaches the metric; null until one exists. */
  lesson: { moduleSlug: string; lessonSlug: string } | null;
  /** Lab page where a learner can try the metric when a lesson has no concrete instrument to open. */
  labHref: string;
};

export const metricGlossary = {
  "simple-return": {
    id: "simple-return",
    name: "Jednoduchý výnos",
    summary: "Změna ceny mezi první a poslední zavírací cenou období.",
    formula: "R = \\frac{P_{\\text{konec}}}{P_{\\text{začátek}}} - 1",
    conventions: { instrument: "Výnos = konečná cena ÷ počáteční cena − 1. Dividendy se nezahrnují, proto jde o cenový výnos." },
    lesson: { moduleSlug: "returns", lessonSlug: "what-is-a-return" },
    labHref: "/lab/compare",
  },
  "cumulative-return": {
    id: "cumulative-return",
    name: "Celkový výnos",
    summary: "Změna od počáteční částky za celé období. Není přepočtený na rok.",
    formula: "R = \\frac{V_{\\text{konec}}}{V_0} - 1",
    conventions: {},
    lesson: { moduleSlug: "returns", lessonSlug: "compounding-and-cumulative-returns" },
    labHref: "/lab/backtesting",
  },
  "annualised-return": {
    id: "annualised-return",
    name: "Roční výnos",
    shortName: "CAGR",
    summary: "Stálé roční tempo, které by od začátku vedlo ke stejnému konci. Ne výnos každého roku.",
    formula: "R_{\\text{roční}} = (1 + R)^{1/t} - 1",
    conventions: {
      instrument: "Roční výnos je geometrický průměr: (1 + výnos období)^(365,25 ÷ počet dní) − 1. Stejný výnos každý rok by vedl ke stejnému výsledku; skutečné roky byly nerovné.",
      backtest: "Přepočteno na rok: stálé roční tempo od začátku do konce. Ne výnos každého roku.",
    },
    lesson: { moduleSlug: "returns", lessonSlug: "compounding-and-cumulative-returns" },
    labHref: "/lab/backtesting",
  },
  "max-drawdown": {
    id: "max-drawdown",
    name: "Největší propad",
    summary: "Největší pokles od předchozího vrcholu k následnému dnu (max. drawdown).",
    formula: "\\text{MDD} = \\min_t \\Big( \\frac{V_t}{M_t} - 1 \\Big) \\\\ M_t = \\max_{s \\le t} V_s",
    conventions: {
      instrument: "Největší propad (max. drawdown) měří, o kolik cena klesla od nejvyšší předchozí zavírací ceny k nejnižší následné. Ukazuje, jak hluboký pokles investor v tomto období zažil.",
      backtest: "Největší pokles od předchozího maxima, měřený na konci měsíce (max. drawdown).",
    },
    lesson: { moduleSlug: "volatility", lessonSlug: "max-drawdown" },
    labHref: "/lab/compare",
  },
  volatility: {
    id: "volatility",
    name: "Volatilita",
    summary: "Typické kolísání výnosů za rok. Neříká nic o tom, kterým směrem cena půjde.",
    formula: "\\sigma_{\\text{roční}} = s \\cdot \\sqrt{N}",
    conventions: {
      instrument: "Směrodatná odchylka denních jednoduchých výnosů, vynásobená √252. Vyšší hodnota znamená větší kolísání ceny; neříká nic o tom, kterým směrem cena půjde.",
      backtest: "Anualizované kolísání měsíčních výnosů. Ne každý typ rizika.",
    },
    lesson: { moduleSlug: "volatility", lessonSlug: "what-is-volatility" },
    labHref: "/lab/compare",
  },
  "sharpe-ratio": {
    id: "sharpe-ratio",
    name: "Sharpeho poměr",
    summary: "Výnos nad bezrizikovou sazbou na jednotku volatility (Sharpe ratio). Vyšší znamená víc výnosu za stejné kolísání.",
    formula: "S = \\frac{R - R_f}{\\sigma}",
    conventions: { backtest: "Anualizovaný výnos nad bezrizikovou sazbou na jednotku volatility (Sharpe ratio). Vyšší znamená víc výnosu za stejné kolísání. Za krátké období je nestabilní." },
    lesson: null,
    labHref: "/lab/backtesting",
  },
  correlation: {
    id: "correlation",
    name: "Korelace výnosů",
    summary: "Jak moc se výnosy dvou instrumentů pohybovaly spolu: od −1 přes 0 do +1.",
    formula: "r = \\frac{\\operatorname{cov}(r_A, r_B)}{\\sigma_A \\, \\sigma_B}",
    conventions: { instrument: "Pearsonova korelace denních cenových výnosů za dny, kdy se obchodovaly oba instrumenty. +1 znamená, že se výnosy pohybovaly vždy spolu, −1 vždy opačně a 0, že mezi nimi nebyl lineární vztah. Každý instrument zůstává ve své měně, bez přepočtu do korun. Korelace se v čase mění a neříká nic o tom, jak velké pohyby byly." },
    lesson: null,
    labHref: "/lab/compare",
  },
} as const satisfies Record<MetricId, MetricGlossaryEntry>;

export function metricEntry(id: MetricId): MetricGlossaryEntry {
  return metricGlossary[id];
}

/** The explanation a Lab shows: its own convention, else the general summary. */
export function metricExplanation(id: MetricId, context: MetricContext) {
  const entry = metricEntry(id);
  return entry.conventions[context] ?? entry.summary;
}

export type MetricLessonLink = { href: string; label: string };

/** `Lekce: <title>` from the curriculum, so a renamed lesson renames every Lab link. */
export function metricLessonLink(id: MetricId): MetricLessonLink | null {
  const target = metricEntry(id).lesson;
  if (!target) return null;
  const lesson = curriculumLessons.find((candidate) => candidate.moduleSlug === target.moduleSlug && candidate.slug === target.lessonSlug);
  if (!lesson || lesson.status !== "available") return null;
  return { href: `/learn/${lesson.moduleSlug}/${lesson.slug}`, label: `Lekce: ${lesson.title}` };
}

/** Anchor id of a metric on a Lab page, so a lesson can land on the number itself. */
export function metricAnchor(id: MetricId) {
  return `metric-${id}`;
}

/**
 * Where a lesson's „Vyzkoušej v Labu“ leads: the metric on the lesson's own instrument when the
 * metric lives on the instrument detail, otherwise the Lab page that shows it.
 */
export function metricLabLink(id: MetricId, instrumentHref: string | null = null): { href: string; label: string } {
  const entry = metricEntry(id);
  const href = instrumentHref && entry.conventions.instrument ? `${instrumentHref}#${metricAnchor(id)}` : entry.labHref;
  return { href, label: `Vyzkoušej v Labu: ${entry.name}` };
}
