import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// PRODUCT.md › Voice and Tone: address the learner without grammatical gender.
const genderedAddress = [
  /\p{L}+(l|ý|ná)\s?(\/|\()\s?(a|á)\)?(?!\p{L})/u, // zvolil/a, mohl(a), připravený/á
  /(?<!\p{L})(jsi|sis|ses|bys|abys|kdybys)\s+(\p{L}+\s+){0,3}?\p{L}+l(?!\p{L})/iu, // jsi skončil, bys popsal
  /(?<!\p{L})\p{L}+l\s+(jsi|sis|ses|bys)(?!\p{L})/iu, // zvolil jsi
  /(?<!\p{L})(jsi|budeš|buď|bys)\s+(\p{L}+\s+){0,2}?\p{L}+(ý|en)(?!\p{L})/iu, // budeš připravený, jsi připraven
  /(?<!\p{L})\p{L}+ý\s+jsi(?!\p{L})/iu, // jak dobrý jsi
  /(?<!\p{L})tě\s+\p{L}+ého(?!\p{L})/iu, // drží tě přihlášeného
];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

describe("learner-facing copy", () => {
  it("addresses the learner without masculine-only or slashed forms", () => {
    const offenders = files("src").flatMap((path) => readFileSync(path, "utf8").split("\n").flatMap((line, index) => {
      const match = genderedAddress.map((pattern) => line.match(pattern)?.[0]).find(Boolean);
      return match ? [`${path}:${index + 1} „${match}“`] : [];
    }));
    expect(offenders).toEqual([]);
  });
});
