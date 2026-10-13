import { describe, expect, it } from "vitest";
import { displayNameSchema } from "./settings-model";
describe("display name validation", () => {
  it("trims a Unicode name without altering its letters", () => {
    expect(displayNameSchema.parse("  Klára Nováková  ")).toBe("Klára Nováková");
    expect(displayNameSchema.parse("李 明")).toBe("李 明");
  });
  it("rejects empty, oversized and control-character input", () => {
    for (const name of ["", "  ", "a".repeat(81), "Klára\u0000Nováková", "Klára\nNováková"]) expect(displayNameSchema.safeParse(name).success).toBe(false);
    expect(displayNameSchema.safeParse("a".repeat(80)).success).toBe(true);
  });
});
