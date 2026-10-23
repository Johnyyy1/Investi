/**
 * Expert review log for lessons with `factContext.kind` "tax" or "regulatory" (#133).
 * A published lesson of that kind needs its latest record to be an approval of exactly the
 * fact versions it renders today. Every record is also described in docs/education/reviews.md.
 */
export type ContentReview = {
  lessonId: string;
  /** Reviewer role, never a personal identifier in the repository. */
  role: string;
  reviewedAt: string;
  decision: "approved" | "changes-requested";
  /** `key@version` of every fact the reviewer checked. */
  facts: readonly string[];
};

export const contentReviews: readonly ContentReview[] = [];
