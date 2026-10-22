import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FigureDataLabel } from "./figure-data-label";
import { FinanceSlider } from "./finance-slider";
import { CalculatorResult } from "./calculator-result";
import { RecoveryExplorer } from "../lesson/recovery-explorer";

describe("calculator primitives", () => {
  it("names the provenance honestly", () => {
    const labels = [
      [<FigureDataLabel key="model" data={{ kind: "model" }} />, "Modelový příklad"],
      [<FigureDataLabel key="history" data={{ kind: "historical", source: "Test source", asOf: "22. 10. 2026" }} />, "Historická data · Test source · stav k 22. 10. 2026"],
      [<FigureDataLabel key="sample" data={{ kind: "sample" }} />, "Ukázková data"],
      [<FigureDataLabel key="simulation" data={{ kind: "simulation", seed: 129 }} />, "Simulace · seed 129"],
    ] as const;
    for (const [element, label] of labels) expect(renderToStaticMarkup(element)).toContain(label);
  });
  it("keeps comma drafts and connects error descriptions to both native controls", () => {
    const html = renderToStaticMarkup(<FinanceSlider label="Ztráta" value="1,3333" min={0} max={100} onValueChange={() => undefined} error="Zkontroluj hodnotu" />);
    expect(html).toContain('value="1,3333"');
    expect(html).toContain('value="1.3333"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('aria-invalid="true"');
    const descriptions = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1]);
    expect(descriptions).toHaveLength(2);
    expect(new Set(descriptions).size).toBe(1);
    expect(html).toContain(`id="${descriptions[0]}"`);
  });
  it("does not replace a blank or out-of-range draft with a clipped text value", () => {
    for (const value of ["", "-1", "101"]) {
      const html = renderToStaticMarkup(<FinanceSlider label="Ztráta" value={value} min={0} max={100} onValueChange={() => undefined} />);
      expect(html).toContain(`value="${value}"`);
      expect(html).not.toContain('value="NaN"');
    }
  });
  it("uses a named, atomic live result region", () => {
    const html = renderToStaticMarkup(<CalculatorResult>25 %</CalculatorResult>);
    expect(html).toContain('aria-label="Výsledek výpočtu"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
  });
  it("uses the controls in a working recovery calculator", () => {
    const html = renderToStaticMarkup(<RecoveryExplorer />);
    expect(html).toContain('type="range"');
    expect(html).toContain('+25');
    expect(html).toContain('aria-label="Výsledek výpočtu"');
  });
});
