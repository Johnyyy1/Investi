import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { RiskHistoryEntry } from "@/features/lessons/real-history/risk-window";
import type { LessonBlock } from "@/features/lessons/types";
import * as catalog from "@/features/learning/catalog";
import { foundationsContent } from "@/features/lessons/foundations/content";
import { GuidedBlock } from "./guided-block";

vi.mock("@/features/artifacts/actions", () => ({ listArtifacts: vi.fn(), saveArtifact: vi.fn() }));

const bridge: LessonBlock = { id: "lab-bridge", type: "labBridge", title: "Největší propad v Labu", content: "Na detailu instrumentu se propad počítá z denních zavíracích cen.", metric: "max-drawdown" };
const aapl = { instrumentId: "FMP:NASDAQ:AAPL", symbol: "AAPL", name: "Apple Inc.", assetType: "equity" } as const;

describe("lab bridge", () => {
  it("opens the metric on the lesson's own instrument", () => {
    const riskHistory = [{ status: "ok", snapshot: { ...aapl, labHref: "/lab/instruments/FMP%3ANASDAQ%3AAAPL" } }] as unknown as RiskHistoryEntry[];
    const html = renderToStaticMarkup(<GuidedBlock block={bridge} riskHistory={riskHistory} />);
    expect(html).toContain("href=\"/lab/instruments/FMP%3ANASDAQ%3AAAPL#metric-max-drawdown\"");
    expect(html).toContain("Vyzkoušej v Labu: Největší propad");
  });

  it("falls back to the Lab page that shows the metric when the lesson has no loaded instrument", () => {
    const unavailable: RiskHistoryEntry[] = [{ status: "unavailable", instrument: aapl, message: "Nedostupné" }];
    expect(renderToStaticMarkup(<GuidedBlock block={bridge} riskHistory={unavailable} />)).toContain("href=\"/lab/compare\"");
  });

  it("sends a two-instrument metric to the comparison, never to the lesson's own instrument", () => {
    const riskHistory = [{ status: "ok", snapshot: { ...aapl, labHref: "/lab/instruments/FMP%3ANASDAQ%3AAAPL" } }] as unknown as RiskHistoryEntry[];
    const correlation: LessonBlock = { ...bridge, metric: "correlation" };
    const html = renderToStaticMarkup(<GuidedBlock block={correlation} riskHistory={riskHistory} />);
    expect(html).toContain("href=\"/lab/compare\"");
    expect(html).toContain("Vyzkoušej v Labu: Korelace výnosů");
  });

  it("stays plain text without a metric", () => {
    const plain: LessonBlock = { ...bridge, metric: undefined };
    expect(renderToStaticMarkup(<GuidedBlock block={plain} />)).not.toContain("<a ");
  });
});

// Follow-up IDs are authored before publication; the catalog remains the authority for visibility.
describe("lesson follow-up links", () => {
  it("hides unavailable targets and renders their explanation only after publication", () => {
    const block = foundationsContent.find((lesson) => lesson.id === "foundations-markets")!.blocks.find((block) => block.type === "labBridge")!;
    const hidden = renderToStaticMarkup(<GuidedBlock block={block} />);
    expect(hidden).not.toContain("<a ");
    expect(hidden).not.toContain("2.2.2");
    expect(hidden).not.toContain("2.5.3");
    // Simulate publication without introducing a planned lesson into the real catalog.
    const publishedLink = vi.spyOn(catalog, "lessonLink").mockImplementation((id) => id === "costs-spread-and-fees" ? { href: "/learn/costs/spread-and-trading-fees", label: "Lekce: Spread a transakční poplatek" } : null);
    try {
      const published = renderToStaticMarkup(<GuidedBlock block={block} />);
      expect(published).toContain('href="/learn/costs/spread-and-trading-fees"');
      expect(published).toContain("Kolik tě spread stojí v korunách");
      expect(published).not.toContain("2.5.3");
    } finally {
      publishedLink.mockRestore();
    }
  });
});
