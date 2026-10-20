import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RiskHistoryEntry } from "@/features/lessons/real-history/risk-window";
import type { LessonBlock } from "@/features/lessons/types";
import { GuidedBlock } from "./guided-block";

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
