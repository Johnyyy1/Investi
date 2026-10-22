import { afterEach, describe, expect, it, vi } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import postgres from "postgres";
import { MarketDataError } from "@/features/market-data/errors";
import { describeError, logUnexpectedError } from "./server-errors";

function postgresError() {
  // At runtime the constructor takes the server's error fields; the typings only declare Error's.
  return new postgres.PostgresError({
    message: 'insert or update on table "lesson_progress" violates foreign key constraint "lesson_progress_lesson_id_lesson_id_fk"',
    code: "23503", constraint_name: "lesson_progress_lesson_id_lesson_id_fk", table_name: "lesson_progress",
    detail: 'Key (lesson_id)=(foundations-why-invest) is not present in table "lesson".', parameters: ["user-123"],
  } as never);
}

describe("describeError", () => {
  it("keeps the database failure but not Drizzle's query parameters or the row values", () => {
    const error = new DrizzleQueryError("insert into lesson_progress values ($1, $2)", ["user-123", "session-token-abc"], postgresError());
    const described = describeError(error);
    expect(described).toEqual({
      name: "DrizzleQueryError",
      cause: { name: "PostgresError", code: "23503", constraint: "lesson_progress_lesson_id_lesson_id_fk", table: "lesson_progress", message: expect.stringContaining("violates foreign key constraint") },
    });
    expect(JSON.stringify(described)).not.toMatch(/user-123|session-token|Key \(lesson_id\)/);
  });

  it("masks e-mail addresses and bounds the message", () => {
    const described = describeError(new Error(`duplicate account learner.name+qa@example.com ${"x".repeat(400)}`));
    expect(described.message).toMatch(/^duplicate account \[e-mail\] x+$/);
    expect((described.message as string).length).toBe(300);
  });

  it("keeps market-data code and context, and a bounded cause chain", () => {
    const error = new MarketDataError("ProviderUnavailable", "Provider timed out.", { provider: "fmp", instrumentId: "US-XNAS:AAPL" }, { cause: new Error("socket hang up", { cause: new Error("a", { cause: new Error("b") }) }) });
    expect(describeError(error)).toEqual({
      name: "MarketDataError", code: "ProviderUnavailable", message: "Provider timed out.", context: { provider: "fmp", instrumentId: "US-XNAS:AAPL" },
      cause: { name: "Error", message: "socket hang up", cause: { name: "Error", message: "a" } },
    });
  });

  it("does not read thrown non-errors", () => {
    expect(describeError({ email: "learner@example.com" })).toEqual({ type: "object" });
    expect(describeError("learner@example.com")).toEqual({ type: "string" });
  });
});

describe("logUnexpectedError", () => {
  afterEach(() => vi.restoreAllMocks());

  it("writes one prefixed entry with the normalized error only", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    logUnexpectedError("portfolio", "buy", new Error("lock timeout"));
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("[portfolio] buy failed", { error: { name: "Error", message: "lock timeout" } });
  });
});
