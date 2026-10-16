import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const tokens = readFileSync("src/styles/tokens.css", "utf8");
const declarations = Object.fromEntries(
  [...tokens.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
);

function resolve(name: string, seen = new Set<string>()): string {
  if (seen.has(name)) throw new Error(`Circular token reference: ${name}`);
  seen.add(name);
  const value = declarations[name];
  if (!value) throw new Error(`Missing token: ${name}`);
  const reference = value.match(/^var\(--([\w-]+)\)$/)?.[1];
  return reference ? resolve(reference, seen) : value;
}

function color(name: string) {
  const value = resolve(`color-${name}`);
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} does not resolve to an opaque hex color`);
  return value;
}

function luminance(hex: string) {
  const [r, g, b] = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function contrast(a: string, b: string) {
  const values = [luminance(color(a)), luminance(color(b))].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function files(dir: string, suffix: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path, suffix) : path.endsWith(suffix) ? [path] : [];
  });
}

describe("investi design tokens", () => {
  it("keeps the approved core palette", () => {
    expect(["background", "foreground", "surface", "primary", "primary-hover", "primary-pressed", "primary-soft", "progress", "warning", "danger"].map(color))
      .toEqual(["#f7f2e8", "#171717", "#fffcf7", "#236f66", "#1c665e", "#195b53", "#e6f0e9", "#2f8f83", "#f1c75b", "#a63d28"]);
  });

  it.each(["background", "surface", "surface-muted", "surface-sunken", "surface-practice", "primary-soft"])("keeps text and action copy readable on %s", (surface) => {
    for (const text of ["foreground", "secondary", "muted", "primary"]) expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps button labels readable in every state", () => {
    for (const fill of ["primary", "primary-hover", "primary-pressed"]) expect(contrast("primary-foreground", fill)).toBeGreaterThanOrEqual(4.5);
    for (const fill of ["danger", "danger-strong", "danger-strong-hover"]) expect(contrast("danger-foreground", fill)).toBeGreaterThanOrEqual(4.5);
    // Disabled controls are exempt from SC 1.4.3; keep them legible anyway.
    expect(contrast("disabled", "track")).toBeGreaterThanOrEqual(3);
    expect(contrast("danger-strong", "surface")).toBeGreaterThanOrEqual(4.5);
  });

  it.each([["success-ink", "success-soft"], ["warning-ink", "warning-soft"], ["danger-ink", "danger-soft"], ["info-ink", "info-soft"]])("keeps %s readable on %s", (text, tint) => {
    expect(contrast(text, tint)).toBeGreaterThanOrEqual(4.5);
  });

  it("distinguishes interactive outlines and progress fills (SC 1.4.11)", () => {
    expect(contrast("border-strong", "surface")).toBeGreaterThanOrEqual(3);
    expect(contrast("progress", "track")).toBeGreaterThanOrEqual(3);
  });

  it.each(["viz-equity", "viz-etf", "viz-bonds", "viz-cash", "viz-other"])("keeps the %s data mark at 3:1 on surfaces", (mark) => {
    expect(contrast(mark, "surface")).toBeGreaterThanOrEqual(3);
  });

  it("defines one radius, elevation and motion hierarchy", () => {
    expect(["radius-control", "radius-button", "radius-surface", "radius-panel"].map((name) => resolve(name))).toEqual(["8px", "8px", "12px", "12px"]);
    expect(["shadow-elevation-1", "shadow-elevation-2"].map((name) => resolve(name))).toEqual(["0 12px 24px #1717170c", "0 12px 28px #17171724"]);
    expect(Object.keys(declarations).filter((name) => name.startsWith("motion-"))).toEqual(["motion-micro", "motion-surface", "motion-entry"]);
  });

  it("uses Inter for UI text and Manrope for headings", () => {
    expect(resolve("font-sans")).toMatch(/^var\(--font-investi-inter\)/);
    expect(resolve("font-display")).toMatch(/^var\(--font-investi-manrope\)/);
  });

  it("has no legacy aliases or second palette", () => {
    expect(Object.keys(declarations).filter((name) => /(^|-)ql-|investi-(blue|navy|green)|paper|action|teal|butter|font-learning/.test(name))).toEqual([]);
  });
});

describe("product styles", () => {
  // Marketing keeps documented illustration tints; every other stylesheet goes through tokens.
  const stylesheets = files("src", ".css").filter((path) => !path.endsWith("styles/tokens.css") && !path.includes("/marketing/"));

  it.each(stylesheets)("%s uses tokens rather than raw colors", (path) => {
    const css = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/url\([^)]*\)/g, "");
    expect(css.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(|:\s*white\b/gi) ?? []).toEqual([]);
  });

  it.each(stylesheets)("%s references only defined tokens", (path) => {
    const css = readFileSync(path, "utf8");
    const used = [...css.matchAll(/var\(--((?:color|radius|shadow|font|text)-[\w-]+)/g)].map((match) => match[1]);
    expect(used.filter((name) => !(name in declarations) && !name.startsWith("font-investi-"))).toEqual([]);
  });
});
