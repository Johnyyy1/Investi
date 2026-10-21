import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/features/artifacts/actions", () => ({ saveArtifact: vi.fn() }));
import { ArtifactSaveControl } from "./artifact-save-control";
import { artifactConsentText } from "@/features/artifacts/presentation";
import { artifactExamples } from "@/features/artifacts/test-fixtures";

describe("artifact consent boundary", () => {
  it("starts without consent and explains history and erasure before enabling persistence", () => {
    const html = renderToStaticMarkup(<ArtifactSaveControl content={{ kind: "goal_map", payload: artifactExamples.goal_map }} sourceLessonId="foundations-why-invest" />);
    expect(html).toContain(artifactConsentText);
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('checked=""');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Uložit výstup<\/button>/);
  });
  it("offers account saving instead of an artifact write control to guests", () => {
    const html = renderToStaticMarkup(<ArtifactSaveControl content={{ kind: "goal_map", payload: artifactExamples.goal_map }} sourceLessonId="foundations-why-invest" guest />);
    expect(html).toContain('href="/onboarding/save"');
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('Uložit výstup');
  });
});
