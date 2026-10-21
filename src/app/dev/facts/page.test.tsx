import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); } }));
import FactsPage from "./page";

afterEach(() => vi.unstubAllEnvs());

describe("editorial fact overview", () => {
  it("is unavailable in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(FactsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("404");
  });
  it("shows verification, sources and overdue states in development, with a rendered token preview", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const html = renderToStaticMarkup(await FactsPage({ searchParams: Promise.resolve({ date: "2027-04-01" }) }));
    expect(html).toContain("27 klíčů, 28 datovaných verzí");
    expect(html).toContain("Publikace blokována");
    expect(html).toContain("Po termínu revize");
    expect(html).toContain("Údaj může být zastaralý");
    expect(html).toContain("https://portal.gov.cz/sluzby-vs/oznameni-o-osvobozenych-prijmech-S20034");
    expect(html).not.toContain("{{");
  });
});
