import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factRegistry, getFact, isFactPending, type FactKey } from "./registry";
import { prepareLessonFacts } from "./lesson-facts";
import { authoredLessons } from "@/features/lessons/registry";
import type { AuthoredLesson } from "@/features/lessons/types";

const today = "2026-10-22";
// One row for every checkbox in #134, in issue order. These are editorial checks, not lesson IDs.
const items: { id: string; keys: FactKey[]; asOf?: string }[] = [
  { id: "01", keys: ["dan.odkazy_cp"] },
  { id: "02", keys: ["dan.limit_100k"] },
  { id: "03", keys: ["dan.datum_casoveho_testu", "dan.casovy_test_cp"] },
  { id: "04", keys: ["dan.parovani_transi"] },
  { id: "05", keys: ["dan.hranice_priznani"] },
  { id: "06", keys: ["dan.dary_dedictvi_cp"] },
  { id: "07", keys: ["dan.jednotny_kurz"] },
  { id: "08", keys: ["dan.urok_srazka", "dan.urok_broker"] },
  { id: "09", keys: ["dan.kupony"] },
  { id: "10", keys: ["dan.srazka_35"] },
  { id: "11", keys: ["dan.w8ben"] },
  { id: "12", keys: ["dan.zapocet_at_nl_fr", "dan.dividendy_zahranicni"] },
  { id: "13", keys: ["dan.fond_irsko"] },
  { id: "14", keys: ["dan.tiskopis"] },
  { id: "15", keys: ["gfo.nahrada"] },
  { id: "16", keys: ["vklady.limit"] },
  { id: "17", keys: ["gfo.zahranicni"] },
  { id: "18", keys: ["eu.priips_ucits"] },
  { id: "19", keys: ["dps.zmeny_2026", "dps.statni_prispevek", "dps.odpocet", "dip.podminky", "zam.pojistne"] },
  { id: "20", keys: ["dan.hranice_23_2026", "dan.sazby_dpfo"] },
  { id: "21", keys: ["dan.lhuty_priznani"] },
  { id: "22", keys: ["dan.evidence_dukazni_bremeno"] },
  { id: "23", keys: ["krypto.dac8"] },
  { id: "24", keys: ["esma.cfd"] },
  { id: "25", keys: ["ucto.ifrs_usgaap"] },
  { id: "26", keys: ["plan.rezerva"] },
  { id: "27", keys: ["dps.statni_prispevek"] },
];

// Freeze this edition's editorial approvals; deriving expectations from registry status would miss accidental promotion.
const approved = new Set<FactKey>([
  "dan.limit_100k", "dan.urok_srazka", "dan.srazka_35", "dan.w8ben", "gfo.nahrada", "vklady.limit",
  "dps.zmeny_2026", "dps.statni_prispevek", "dan.hranice_23_2026", "esma.cfd", "plan.rezerva",
]);

function draft(key: FactKey, asOf: string): AuthoredLesson {
  return { id: "research-fixture", slug: "research-fixture", moduleSlug: "research-fixture", title: "Revize", eyebrow: "", position: 1, estimatedMinutes: 1, sections: [], factContext: { kind: "tax", asOf }, blocks: [{ id: "value", type: "paragraph", content: `{{${key}}}` }] };
}

describe("CONTENT-03 research and publication safety", () => {
  it("accounts for all 27 issue items in the report using existing dated keys", () => {
    expect(items.map(({ id }) => id)).toEqual(Array.from({ length: 27 }, (_, i) => String(i + 1).padStart(2, "0")));
    const report = readFileSync(new URL("../../../docs/education/reviews.md", import.meta.url), "utf8");
    for (const { id, keys, asOf = today } of items) {
      expect(report).toContain(`| ${id} |`);
      for (const key of keys) {
        expect(report).toContain(`\`${key}\``);
        expect(() => getFact(key, asOf)).not.toThrow();
      }
    }
  });

  for (const { id, keys, asOf = today } of items) {
    it(`enforces the evidence decision for issue item ${id}`, () => {
      for (const key of keys) {
        const fact = getFact(key, asOf);
        if (!approved.has(key)) {
          expect(isFactPending(fact)).toBe(true);
          expect(() => prepareLessonFacts(draft(key, asOf), factRegistry, { today, published: true })).toThrow(/Unverified|blocked/);
        } else {
          expect(isFactPending(fact)).toBe(false);
          expect(fact.verificationStatus).toBe("primary");
          expect(fact.verifiedAt).toBe(today);
          expect(prepareLessonFacts(draft(key, asOf), factRegistry, { today, published: true }).notice?.verifiedAt).toBe(today);
        }
      }
    });
  }

  it("never promotes unresolved dates, lot matching, treaty credits or future annual inputs", () => {
    for (const key of ["dan.odkazy_cp", "dan.datum_casoveho_testu", "dan.parovani_transi", "dan.jednotny_kurz", "dan.zapocet_at_nl_fr", "dan.lhuty_priznani", "krypto.dac8"] as const) {
      expect(getFact(key, today)).toMatchObject({ verificationStatus: "unverified", verifiedAt: null, checkedAt: today });
      expect(getFact(key, today).publicationBlockedBy).toContain("134");
    }
  });

  it("preserves 2025 rates/deadlines and does not treat a 2026 placeholder as usable", () => {
    expect(getFact("dan.jednotny_kurz", "2025-12-31")).toMatchObject({ taxPeriod: "2025", verificationStatus: "primary", value: { amount: "EUR 24,66 Kč; USD 21,84 Kč" } });
    expect(getFact("dan.lhuty_priznani", "2025-12-31").value.amount).toContain("4. 5. 2026");
    expect(getFact("dan.jednotny_kurz", today).value.amount).not.toMatch(/24,66|21,84/);
    expect(() => getFact("dps.zmeny_2026", "2026-07-31")).toThrow(/applicable/);
    expect(getFact("dps.zmeny_2026", "2026-08-01").verificationStatus).toBe("primary");
  });

  it("keeps the former pension threshold and unresolved tax instructions out of authored lessons", () => {
    // At this edition all affected tax/pension lessons are still planned. This forces a review when authored.
    const publishedText = JSON.stringify(authoredLessons);
    expect(publishedText).not.toMatch(/penzijn|penzijk|W-8BEN|DAC8|FIFO|§\s*(4|38)/i);
    expect(getFact("dan.urok_srazka", today).label).toContain("nepodnikatelského");
    expect(getFact("dan.srazka_35", today).notes).toContain("nerezidenta");
    expect(getFact("plan.rezerva", today).notes).toContain("příjmů, nikoli výdajů");
  });
});
