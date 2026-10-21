import { describe, expect, it } from "vitest";
import { accountExportFilename, buildAccountExport, serializeAccountExport, type AccountExportRows } from "./export";

const at = new Date("2026-10-16T08:30:00.000Z");
function rows(): AccountExportRows {
  return {
    owner: { id: "u1", name: "Klára", email: "klara@example.com", emailVerified: true, image: null, isAnonymous: false, anonymousKind: null, createdAt: at, updatedAt: at },
    accounts: [{ providerId: "credential", accountId: "u1", scope: null, createdAt: at, updatedAt: at }],
    sessions: [{ createdAt: at, updatedAt: at, expiresAt: at, ipAddress: "198.51.100.7", userAgent: "Firefox" }],
    profile: { brokerFeeProfileId: null, userId: "u1", experienceLevel: "BEGINNER", goals: [], interests: [], dailyGoalMinutes: 10, timeZone: "Europe/Prague", recommendedStart: null, onboardingStep: 6, diagnosticResult: null, personalizedOnboardingCompletedAt: null, onboardingCompletedAt: at, updatedAt: at } as AccountExportRows["profile"],
    progress: [{ moduleSlug: "zaklady", lessonSlug: "co-je-akcie", lessonTitle: "Co je akcie", status: "completed", lastPosition: 3, completedAt: at, updatedAt: at }],
    awards: [{ moduleSlug: "returns", lessonSlug: "vynos", xp: 60, practiceCapitalMinor: 200000n, rewardPolicyVersion: 3, learningDate: "2026-10-16", timeZone: "Europe/Prague", awardedAt: at }],
    unlocks: [{ userId: "u1", unlockId: "PORTFOLIO_LAB", practiceCapitalMinor: 500000n, reason: "foundations_complete", unlockedAt: at }],
    portfolios: [
      { id: "p1", userId: "u1", baseCurrency: "CZK", openedAt: at, closedAt: at, resetFromPortfolioId: null, resetIdempotencyKey: null, openingCapitalMinor: 500000n },
      { id: "p2", userId: "u1", baseCurrency: "CZK", openedAt: at, closedAt: null, resetFromPortfolioId: "p1", resetIdempotencyKey: "k", openingCapitalMinor: 700000n },
    ],
    trades: [{ id: "t1", portfolioId: "p1", quantity: "0.33333333", unitPrice: "1.25000000", fxRateToBase: "23.456789012345", grossAmountBaseMinor: 977n, feeBaseMinor: 0n, cashDeltaBaseMinor: -977n } as AccountExportRows["trades"][number]],
    allocations: [{ id: "a1", portfolioId: "p2", createdAt: at, cashWeightBasisPoints: 1000, appliedValueMinor: 700000n, clientIdempotencyKey: "m" }],
    artifacts: [{ id: "artifact1", userId: "u1", kind: "goal_map", version: 1, payload: { goals: [] }, createdAt: at, sourceLessonId: "foundations-why-invest", requestId: "r1" }],
    lines: [{ allocationId: "a1", position: 0, instrumentId: "i1", instrumentSymbol: "VWCE", instrumentName: "World ETF", instrumentAssetType: "etf", quoteCurrency: "EUR", weightBasisPoints: 9000 }],
  };
}

describe("account export", () => {
  it("nests trades and target mixes under their generation and keeps exact amounts", () => {
    const data = buildAccountExport(rows(), at);
    expect(data.portfolios.map((generation) => [generation.id, generation.trades.length, generation.targetMixes.length])).toEqual([["p1", 1, 0], ["p2", 0, 1]]);
    expect(data.portfolios[1].targetMixes[0].lines).toEqual([expect.objectContaining({ instrumentSymbol: "VWCE", weightBasisPoints: 9000 })]);
    const parsed = JSON.parse(serializeAccountExport(data));
    expect(parsed.learnerArtifacts).toEqual([{ id: "artifact1", kind: "goal_map", version: 1, payload: { goals: [] }, createdAt: at.toISOString(), sourceLessonId: "foundations-why-invest" }]);
    expect(parsed.exportedAt).toBe("2026-10-16T08:30:00.000Z");
    expect(parsed.lessonRewardReceipts[0].practiceCapitalMinor).toBe("200000");
    expect(parsed.progressionUnlocks[0].practiceCapitalMinor).toBe("500000");
    expect(parsed.portfolios[0].trades[0]).toMatchObject({ quantity: "0.33333333", fxRateToBase: "23.456789012345", cashDeltaBaseMinor: "-977" });
    expect(parsed.sessions[0]).toEqual({ createdAt: at.toISOString(), updatedAt: at.toISOString(), expiresAt: at.toISOString(), ipAddress: "198.51.100.7", userAgent: "Firefox" });
  });

  it("drops internal owner keys and never carries credentials", () => {
    const text = serializeAccountExport(buildAccountExport(rows(), at));
    for (const forbidden of ["userId", "portfolioId", "allocationId", "password", "accessToken", "refreshToken", "idToken", "\"token\""]) expect(text).not.toContain(forbidden);
  });

  it("exports a learner without profile or portfolio", () => {
    const empty = { ...rows(), profile: null, portfolios: [], trades: [], allocations: [], lines: [], unlocks: [] };
    const data = buildAccountExport(empty, at);
    expect(data.learningProfile).toBeNull();
    expect(data.portfolios).toEqual([]);
  });

  it("names the download after the export day", () => {
    expect(accountExportFilename(at)).toBe("investnik-moje-data-2026-10-16.json");
  });
});
