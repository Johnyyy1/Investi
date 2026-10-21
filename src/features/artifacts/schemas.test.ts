import { describe, expect, it } from "vitest";
import { artifactContentSchema, artifactKinds, artifactPayloadSchemas, saveArtifactSchema } from "./schemas";
import { artifactExamples } from "./test-fixtures";

const request = { content: { kind: "goal_map", payload: artifactExamples.goal_map }, sourceLessonId: "foundations-why-invest", consent: true, requestId: "2febc313-313b-40ba-af9a-a93534e3cabf" };
describe("typed artifact payloads", () => {
  it.each(artifactKinds)("validates %s and rejects missing or unrecognized fields", (kind) => {
    expect(artifactContentSchema.safeParse({ kind, payload: artifactExamples[kind] }).success).toBe(true);
    for (const payload of [{}, null, [], { ...artifactExamples[kind], bankAccount: "private" }]) {
      expect(artifactPayloadSchemas[kind].safeParse(payload).success).toBe(false);
    }
    expect(artifactContentSchema.safeParse({ kind, payload: artifactExamples[kind], userId: "other" }).success).toBe(false);
  });
  it("rejects mismatched kinds, oversized and empty prose, and fabricated kinds", () => {
    expect(artifactContentSchema.safeParse({ kind: "goal_map", payload: artifactExamples.fee_profile }).success).toBe(false);
    expect(artifactContentSchema.safeParse({ kind: "unknown", payload: {} }).success).toBe(false);
    for (const label of [" ", "x".repeat(161)]) expect(artifactPayloadSchemas.fee_profile.safeParse({ ...artifactExamples.fee_profile, label }).success).toBe(false);
    expect(artifactPayloadSchemas.journal.safeParse({ entries: Array(31).fill(artifactExamples.journal.entries[0]) }).success).toBe(false);
  });
  it("keeps financial check-up categorical and rejects raw income, debts and identifiers", () => {
    for (const field of ["income", "budgetAmount", "debtAmount", "accountNumber"]) expect(artifactPayloadSchemas.financial_checkup.safeParse({ ...artifactExamples.financial_checkup, [field]: 50000 }).success).toBe(false);
  });
  it("uses canonical exact minor-unit strings and integer basis points", () => {
    for (const orderFeeMinor of [0.1, 0.25, 1.3333, "0.1", "01", "-1", "1e2", "1000000000000000"]) expect(artifactPayloadSchemas.fee_profile.safeParse({ ...artifactExamples.fee_profile, orderFeeMinor }).success).toBe(false);
    for (const orderFeeMinor of ["0", "1", "25", "13333", "999999999999999"]) expect(artifactPayloadSchemas.fee_profile.safeParse({ ...artifactExamples.fee_profile, orderFeeMinor }).success).toBe(true);
    for (const fxSpreadBasisPoints of [0.25, -1, 10001, NaN, Infinity]) expect(artifactPayloadSchemas.fee_profile.safeParse({ ...artifactExamples.fee_profile, fxSpreadBasisPoints }).success).toBe(false);
  });
  it("checks meaningful allocation totals and calendar dates", () => {
    const plan = artifactExamples.investment_plan;
    for (const allocation of [[{ assetClass: "cash", weightBasisPoints: 9000 }], [{ assetClass: "cash", weightBasisPoints: 5000 }, { assetClass: "cash", weightBasisPoints: 5000 }]]) expect(artifactPayloadSchemas.investment_plan.safeParse({ ...plan, allocation }).success).toBe(false);
    expect(artifactPayloadSchemas.investment_thesis.safeParse({ ...artifactExamples.investment_thesis, reviewOn: "2026-02-30" }).success).toBe(false);
  });
  it("requires explicit consent, known stable lesson identity and a retry key; rejects owner/version input", () => {
    expect(saveArtifactSchema.safeParse(request).success).toBe(true);
    expect(saveArtifactSchema.safeParse({ ...request, sourceLessonId: null }).success).toBe(true);
    for (const patch of [{ consent: false }, { consent: undefined }, { sourceLessonId: "0.1.4" }, { requestId: "bad" }, { userId: "other" }, { version: 99 }]) expect(saveArtifactSchema.safeParse({ ...request, ...patch }).success).toBe(false);
  });
});
