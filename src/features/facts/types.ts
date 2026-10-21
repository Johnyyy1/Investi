export type FactValue = { amount: number | string; unit: string };

/** Dates are ISO calendar dates. validTo is inclusive; gaps never fall back to today's rule. */
export type FactVersion = {
  key: string;
  version: string;
  label: string;
  value: FactValue;
  jurisdiction: string;
  legalBasis: string;
  validFrom: string;
  validTo?: string;
  /** Observation / study / regulatory period, separate from applicability. */
  period: string;
  taxPeriod?: string;
  sources: readonly { title: string; url: string }[];
  verifiedAt: string | null;
  /** A failed verification is a check, not a successful verification. */
  checkedAt: string;
  verificationStatus: "primary" | "secondary" | "unverified";
  owner: string;
  nextReviewAt: string;
  notes: string;
  publicationBlockedBy?: string;
  research?: { sample: string; period: string; limitations: string };
};

export type LessonFactNotice = {
  verifiedAt: string;
  staleFacts: string[];
};
