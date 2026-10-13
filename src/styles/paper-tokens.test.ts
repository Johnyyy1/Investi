import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const css = readFileSync("src/styles/paper-tokens.css", "utf8");
const colors = Object.fromEntries([...css.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6});/g)].map((match) => [match[1], match[2]]));
function luminance(hex: string) {
  const [r, g, b] = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return r * .2126 + g * .7152 + b * .0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(colors[a]), luminance(colors[b])].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
describe("Pen design-system contrast", () => {
  it.each(["paper", "paper-surface", "surface-practice", "teal-soft"])("keeps ink, metadata and action text readable on %s", (surface) => {
    for (const text of ["ink", "text-secondary", "text-muted", "action"]) expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
  });
  it("distinguishes interactive outlines and progress fills", () => {
    expect(contrast("control-outline", "paper-surface")).toBeGreaterThanOrEqual(3);
    expect(contrast("teal", "track")).toBeGreaterThanOrEqual(3);
    expect(contrast("error-ink", "error-tint")).toBeGreaterThanOrEqual(4.5);
  });
  it.each(["viz-equity", "viz-etf", "viz-bonds", "viz-cash", "viz-other"])("keeps the %s data mark at 3:1 on cards (SC 1.4.11)", (mark) => {
    expect(contrast(mark, "paper-surface")).toBeGreaterThanOrEqual(3);
  });
  it.each(["butter-ink", "info-ink", "error-ink", "action"])("keeps %s status text readable on its tint", (text) => {
    const tint = { "butter-ink": "butter-tint", "info-ink": "info-tint", "error-ink": "error-tint", action: "teal-soft" }[text]!;
    expect(contrast(text, tint)).toBeGreaterThanOrEqual(4.5);
  });
});
