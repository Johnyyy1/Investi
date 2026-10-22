import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonFactNotice } from "./lesson-fact-notice";

describe("lesson fact disclosure", () => {
  it("renders an accessible, dated educational notice without a spurious stale warning", () => {
    const html = renderToStaticMarkup(<LessonFactNotice notice={{ verifiedAt: "2026-10-21", staleFacts: [] }} />);
    expect(html).toContain("Vzdělávací obsah, ne daňové ani investiční poradenství");
    expect(html).toContain('dateTime="2026-10-21"');
    expect(html).toContain("21. 10. 2026");
    expect(html).not.toContain('role="status"');
  });
  it("warns with text and safely escapes authored labels", () => {
    const html = renderToStaticMarkup(<LessonFactNotice notice={{ verifiedAt: "2025-01-01", staleFacts: ["<script>rule</script>"] }} />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Údaj může být zastaralý");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
