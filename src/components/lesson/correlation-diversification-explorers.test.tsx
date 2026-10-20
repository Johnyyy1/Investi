import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommonFactorExplorer, CorrelationExplorer, CrisisCorrelationExplorer } from "./correlation-explorers";
import { ConcentrationExplorer, ExposureExplorer, LookThroughExplorer, PortfolioCorrelationExplorer } from "./diversification-explorers";
import { DiversificationScenario } from "./diversification-scenario";

const html = (element: React.ReactElement) => renderToStaticMarkup(element);

describe("correlation explorers", () => {
  it("shows the coefficient next to a scatter, a text alternative and a value table", () => {
    const markup = html(<CorrelationExplorer />);
    expect(markup).toContain("Korelace výnosů A a B");
    expect(markup).toContain("0,94");
    expect(markup).toMatch(/role="img" aria-label="Dvojice Spolu: osm měsíců/);
    expect(markup).toContain("Zobrazit hodnoty v tabulce");
    expect(markup).toContain('aria-pressed="true"');
  });

  it("starts the common-factor explorer at a 50 % share with 0,72", () => {
    const markup = html(<CommonFactorExplorer />);
    expect(markup).toContain("Podíl společného pohybu trhu: 50 %");
    expect(markup).toContain("0,72");
    expect(markup).toContain("Žádný");
  });

  it("starts the crisis explorer in the calm months", () => {
    const markup = html(<CrisisCorrelationExplorer />);
    expect(markup).toContain("0,24");
    expect(markup).toContain("−1,5 %");
  });
});

describe("diversification explorers", () => {
  it("flags the 40 % position against the 25 % teaching rule in words, not colour only", () => {
    const markup = html(<ConcentrationExplorer />);
    expect(markup).toContain("Největší pozice: Firma A");
    expect(markup).toContain("40,0 %");
    expect(markup).toContain("Cíl: ≤ 25 %");
    expect(markup).toContain("Nesplněno");
    expect(markup).toContain("−16,00 %");
  });

  it("splits five tech stocks into one sector and cash", () => {
    const markup = html(<ExposureExplorer />);
    expect(markup).toContain("Technologie");
    expect(markup).toContain("90,0 %");
    expect(markup).toContain("Hotovost");
  });

  it("looks through the funds to 25,6 % in Čip with its three sources", () => {
    const markup = html(<LookThroughExplorer />);
    expect(markup).toContain("Čip 25,6 %");
    expect(markup).toContain("Akcie Čip 20,0 % · Fond Technologie 3,6 % · Fond Svět 2,0 %");
  });

  it("compares the portfolio volatility with the weighted average", () => {
    const markup = html(<PortfolioCorrelationExplorer />);
    expect(markup).toContain("13,23 %");
    expect(markup).toContain("15,00 %");
  });
});

describe("diversification scenario", () => {
  it("is a separate scenario that starts empty, locked behind a decision and a prediction", () => {
    const markup = html(<DiversificationScenario />);
    expect(markup).toContain("Scénářový kapitál 100 000 Kč.");
    expect(markup).toContain("nic se nenakupuje v tvém Portfolio Labu");
    expect(markup).toContain("Fond Svět: přidat 10 %");
    expect(markup).toContain("Nejdřív něco investuj.");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>.*Zamknout rozhodnutí/);
    expect(markup).not.toMatch(/Splněno|Nesplněno|Technologický propad/);
  });
});
