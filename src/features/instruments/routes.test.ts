import { describe, expect, it } from "vitest";
import { instrumentCompareHref, instrumentDetailHref, resolveInstrumentQueryParam, resolveInstrumentRouteParam } from "./routes";

describe("instrument detail routing", () => {
  it.each(["US-XNAS:AAPL", "IE-XETR:VWCE", "FMP:NASDAQ:AAPL", "FMP:XETRA:BRK%2FB"]) ("round trips %s without changing identity", (id) => {
    const segment = instrumentDetailHref(id).split("/").at(-1)!;
    expect(resolveInstrumentRouteParam(segment)).toBe(id);
    expect(resolveInstrumentRouteParam(decodeURIComponent(segment))).toBe(id);
  });
  it.each(["", ".", "..", "A/B", "A\\B", "A?B", "FMP:NASDAQ:", "FMP::AAPL", "FMP:NASDAQ:A%ZZ", "FMP:A:B:C", "A\nB"]) ("rejects malformed identity %s", (id) => {
    expect(resolveInstrumentRouteParam(id)).toBeNull();
    expect(() => instrumentDetailHref(id)).toThrow();
  });
  it("accepts a valid ID even when its URL-encoded form is over 100 characters", () => {
    const id = `FMP:NASDAQ:${"A".repeat(75)}`;
    expect(resolveInstrumentRouteParam(instrumentDetailHref(id).split("/").at(-1))).toBe(id);
  });
});

describe("instrument comparison routing", () => {
  function decodedQuery(href: string) {
    return Object.fromEntries(new URL(href, "http://localhost").searchParams);
  }
  it.each(["US-XNAS:AAPL", "IE-XETR:VWCE", "FMP:NASDAQ:AAPL", "FMP:XETRA:BRK%2FB"])("round trips %s through the query string without changing identity", (id) => {
    const query = decodedQuery(instrumentCompareHref(id, "US-XNAS:MSFT", "1Y"));
    expect(query).toEqual({ a: id, b: "US-XNAS:MSFT", range: "1Y" });
    expect(resolveInstrumentQueryParam(query.a)).toBe(id);
  });
  it("leaves out the instruments and range that are not chosen yet", () => {
    expect(instrumentCompareHref(null)).toBe("/lab/compare");
    expect(instrumentCompareHref("US-XNAS:AAPL")).toBe("/lab/compare?a=US-XNAS%3AAAPL");
    expect(instrumentCompareHref("US-XNAS:AAPL", null, "5Y")).toBe("/lab/compare?a=US-XNAS%3AAAPL&range=5Y");
  });
  it.each(["", "A/B", "FMP:NASDAQ:", "FMP:NASDAQ:A%ZZ", "A\nB"])("rejects malformed identity %s", (id) => {
    expect(resolveInstrumentQueryParam(id)).toBeNull();
    expect(() => instrumentCompareHref(id)).toThrow();
    expect(() => instrumentCompareHref("US-XNAS:AAPL", id)).toThrow();
  });
  it("rejects repeated parameters and values a second decode would rewrite", () => {
    expect(resolveInstrumentQueryParam(["US-XNAS:AAPL", "US-XNAS:MSFT"])).toBeNull();
    expect(resolveInstrumentQueryParam("US-XNAS%3AAAPL")).toBeNull();
  });
});

