import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// docs/terminology.md: one UI name per concept. Each pattern is a retired variant.
const retiredTerms: [RegExp, string][] = [
  [/(?<!\p{L})Studov(na|ny|ně|nu|nou)(?!\p{L})/u, "Učení"],
  [/(?<!\p{L})virtuáln\p{L}* kapitál/iu, "cvičný kapitál"],
  [/(?<!\p{L}|cvičn\p{L}* )kapitál z lekcí/iu, "cvičný kapitál"],
  [/(?<!\p{L})cvičn\p{L}* pen(íze|ěz)/iu, "cvičný kapitál"],
  [/(?<!\p{L})maximální drawdown/iu, "Největší propad"],
  // Drawdown used as a word in copy; identifiers and the bracketed supplement pass.
  [/(?<![\p{L}(.-]|max\. )drawdown(u|em)?(?= \p{Ll}| \d|[.,"](?!\p{L}))/iu, "propad (drawdown) / Největší propad (max. drawdown)"],
  [/(?<!\p{L})body (za lekce|nemění)/iu, "XP"],
  [/aria-label="[^"]*investi(!| —)/u, "investi · …"],
];
const czech = /[ěščřžýáíéůúňťď]/i;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

/** Comments may use internal names (StudovnaPage, drawdown); only code and copy are checked. */
const isComment = (line: string) => /^\s*(\/\/|\/\*|\*)/.test(line);

describe("UI terminology", () => {
  it("uses one name per concept", () => {
    const offenders = files("src").flatMap((path) => readFileSync(path, "utf8").split("\n").flatMap((line, index) => {
      if (isComment(line)) return [];
      const hits = retiredTerms.flatMap(([pattern, use]) => {
        const match = line.match(pattern)?.[0];
        return match ? [`„${match}“ → ${use}`] : [];
      });
      // English is fine in code and the English export; Czech copy says „cvičný kapitál“.
      if (line.includes("Practice Capital") && czech.test(line)) hits.push("„Practice Capital“ → cvičný kapitál");
      return hits.map((hit) => `${path}:${index + 1} ${hit}`);
    }));
    expect(offenders).toEqual([]);
  });
});
