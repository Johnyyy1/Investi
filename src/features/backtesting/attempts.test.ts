import { expect, it } from "vitest";
import { readAttempts, recordAttempt } from "./attempts";

it("counts distinct specs per goal, preserving retries and other goals", () => {
  const first = recordAttempt({}, "costs", { amount: 100 });
  expect(recordAttempt(first, "costs", { amount: 100 })).toEqual(first);
  const second = recordAttempt(first, "costs", { amount: 200 });
  expect(second.costs).toHaveLength(2);
  expect(recordAttempt(second, "withdrawals", { amount: 100 }).withdrawals).toHaveLength(1);
  expect(readAttempts(JSON.stringify(second))).toEqual(second);
});
it("recovers from absent, malformed or unrelated browser storage", () => {
  for (const value of [null, "broken", "null", "[]", '{"costs":12}']) expect(readAttempts(value)).toEqual({});
});
