import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Recommendation } from "@/components/personalization/recommendation";
import { PreferenceFields } from "@/components/personalization/preference-fields";
import { PersonalizationPrompt } from "@/components/personalization/personalization-prompt";
import { defaultPreferences, readLearnerProfile } from "./profile";
import { recommendLearning } from "./recommendation";
import { diagnosticQuestions } from "./diagnostic";
import { restoreDraft } from "./draft";
import { goalLabels, presentRecommendation, reasonLabels } from "./presentation";

describe("personalization presentation", () => {
  it("presents every reason code in Czech without persisting copy", () => {
    expect(Object.keys(reasonLabels)).toHaveLength(16);
    for (const [code, copy] of Object.entries(reasonLabels)) { expect(copy.length).toBeGreaterThan(20); expect(copy).not.toContain(code); }
    expect(reasonLabels.RETURNS_FOR_ETF_PATH).toContain("ETF");
    expect(reasonLabels.RETURNS_FOR_QUANT_PATH).toContain("daty");
  });
  it.each([0, 1, 2, 3])("renders named native choices for preference step %s", (step) => {
    const html = renderToStaticMarkup(createElement(PreferenceFields, { step, value: { ...defaultPreferences, primaryGoal: "LONG_TERM_ETF", interests: ["ETFS", "DATA"] }, onChange: () => {} }));
    expect(html).toContain("<fieldset"); expect(html).toContain("<legend");
    expect(html).toContain(step === 1 ? 'type="checkbox"' : 'type="radio"');
    expect(html.match(/checked=""/g)).toHaveLength(step === 1 ? 2 : 1);
    expect(html).not.toContain("denní cíl");
    if (step === 0) for (const label of Object.values(goalLabels)) expect(html).toContain(label);
    if (step === 3) expect(html).toContain("30+ minut");
  });
  it("uses an actual published lesson and reason in Learn and the result", () => {
    const recommendation = recommendLearning({ profile: readLearnerProfile() });
    expect(presentRecommendation(recommendation).href).toBe("/learn/investing-foundations/why-invest");
    for (const plan of [true, false]) {
      const html = renderToStaticMarkup(createElement(Recommendation, { recommendation, plan }));
      expect(html).toContain(reasonLabels.FOUNDATIONS_START);
      expect(html).toContain(plan ? "Začít doporučenou lekci" : "Doporučeno pro tebe");
      expect(html).not.toMatch(/correctCount|strong_foundations|score/);
    }
  });
  it("handles unavailable recommendations without fabricating a lesson", () => {
    const recommendation = recommendLearning({ curriculum: [] });
    const html = renderToStaticMarkup(createElement(Recommendation, { recommendation }));
    expect(html).toContain("Doporučení není dostupné"); expect(html).toContain('/learn#curriculum');
  });
  it("provides an optional, dismissible personalization entry", () => {
    const html = renderToStaticMarkup(createElement(PersonalizationPrompt, { userId: "qa" }));
    expect(html).toContain("Přizpůsobit učení"); expect(html).toContain("Teď ne"); expect(html).toContain("/onboarding?personalize=1");
  });
  it("restores selections and answer IDs but rejects corrupted or skipped local steps", () => {
    const draft = { preferences: { ...defaultPreferences, primaryGoal: "QUANT" }, step: 4, question: 1, answers: { simple_return: "ten" } };
    expect(restoreDraft(JSON.stringify(draft), diagnosticQuestions)).toEqual(draft);
    expect(restoreDraft("bad json", diagnosticQuestions)).toBeNull();
    expect(restoreDraft(JSON.stringify({ ...draft, answers: {} }), diagnosticQuestions)).toBeNull();
    expect(restoreDraft(JSON.stringify({ ...draft, answers: { score: 100 } }), diagnosticQuestions)).toBeNull();
    expect(restoreDraft(JSON.stringify({ ...draft, step: 99 }), diagnosticQuestions)).toBeNull();
    expect(restoreDraft(JSON.stringify({ ...draft, preferences: { ...draft.preferences, primaryGoal: null } }), diagnosticQuestions)).toBeNull();
  });
});
