import { describe, expect, it } from "vitest";
import { parseNumericAnswer } from "./numeric-input";
import { parsePrice, recoveryReturn, simpleReturn } from "./returns";

describe("shared calculator numeric boundary", () => {
  it.each([["0,1", 0.1], ["0,25", 0.25], ["1,3333", 1.3333], [" 1.3333 ", 1.3333], ["0", 0], ["-0,25", -0.25]])("preserves %s without display rounding", (raw, expected) => {
    expect(parseNumericAnswer(raw)).toBe(expected);
    expect(parsePrice(raw, "Cena")).toBe(expected);
  });
  it.each(["", " ", "0,0,25", "nevim"])("never turns invalid %j into zero", (raw) => {
    expect(parseNumericAnswer(raw)).toBeNaN();
    expect(() => parsePrice(raw, "Cena")).toThrow();
  });
  it.each(["Infinity", "-Infinity", "NaN"])("rejects non-finite model inputs %s", (raw) => {
    expect(() => parsePrice(raw, "Cena")).toThrow();
  });
  it("feeds decimal prices to the existing unrounded model", () => {
    expect(simpleReturn(parsePrice("0,1", "Cena"), parsePrice("0,25", "Cena"))).toBeCloseTo(1.5, 12);
    expect(simpleReturn(parsePrice("0,25", "Cena"), parsePrice("1,3333", "Cena"))).toBeCloseTo(4.3332, 12);
  });
  it.each([0, 0.1, 0.25, 1.3333, 99.99])("recovery reverses a %d percent loss", (lossPercent) => {
    const loss = lossPercent / 100;
    expect((1 - loss) * (1 + recoveryReturn(loss))).toBeCloseTo(1, 12);
  });
  it.each([-0.1, 1, NaN, Infinity])("rejects invalid loss fractions %s", (loss) => {
    expect(() => recoveryReturn(loss)).toThrow();
  });
});
