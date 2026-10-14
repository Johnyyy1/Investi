import { describe, expect, it, vi } from "vitest";

import { createMarketDataService } from "../composition";
import { parseCnbDailyRates } from "./parse";

const FRIDAY_FILE = [
  "09.10.2026 #195",
  "země|měna|množství|kód|kurz",
  "EMU|euro|1|EUR|24,365",
  "Indonesie|rupie|1000|IDR|1,218",
  "Japonsko|jen|100|JPY|13,779",
  "USA|dolar|1|USD|21,745",
  "",
].join("\n");

function textResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain;charset=UTF-8" } });
}

describe("parseCnbDailyRates", () => {
  it("reads the declaration date and per-unit CZK rates with decimal commas", () => {
    const parsed = parseCnbDailyRates(FRIDAY_FILE);
    expect(parsed.date).toBe("2026-10-09");
    expect(parsed.rates.get("USD")).toBe(21.745);
    expect(parsed.rates.get("EUR")).toBe(24.365);
  });

  it("divides by the amount column (JPY per 100, IDR per 1000) without float noise", () => {
    const parsed = parseCnbDailyRates(FRIDAY_FILE);
    expect(parsed.rates.get("JPY")).toBe(0.13779);
    expect(parsed.rates.get("IDR")).toBe(0.001218);
  });

  it("accepts CRLF line endings", () => {
    expect(parseCnbDailyRates(FRIDAY_FILE.replace(/\n/g, "\r\n")).rates.get("USD")).toBe(21.745);
  });

  it.each([
    ["an empty body", ""],
    ["an invalid date", FRIDAY_FILE.replace("09.10.2026", "31.02.2026")],
    ["a malformed rate", FRIDAY_FILE.replace("21,745", "21.745")],
    ["a zero amount", FRIDAY_FILE.replace("|1|USD", "|0|USD")],
    ["a truncated row", FRIDAY_FILE.replace("USA|dolar|1|USD|21,745", "USA|dolar|USD|21,745")],
  ])("rejects %s instead of producing a rate", (_, body) => {
    expect(() => parseCnbDailyRates(body)).toThrowError(expect.objectContaining({ code: "MalformedProviderResponse" }));
  });
});

describe("ČNB FX provider", () => {
  function createService(fetchImplementation: typeof fetch, now: string) {
    return createMarketDataService({ provider: "deterministic", fxProvider: "cnb", cnbFetch: fetchImplementation, clock: () => new Date(now) });
  }

  it("uses Friday's fixing on a weekend and reports its date and source", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => { void input; return textResponse(FRIDAY_FILE); });
    const service = createService(fetchMock, "2026-10-11T10:00:00.000Z");

    await expect(service.getFxRate("USD", "CZK", "2026-10-11T09:59:00.000Z")).resolves.toMatchObject({
      baseCurrency: "USD",
      quoteCurrency: "CZK",
      rate: 21.745,
      referenceDate: "2026-10-09",
      provenance: { provider: "cnb", dataKind: "reference", referenceDate: "2026-10-09" },
    });
    expect(new URL(fetchMock.mock.calls[0][0].toString()).searchParams.get("date")).toBe("11.10.2026");
  });

  it("asks for the fixing valid on the quote's day, never a newer one", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => { void input; return textResponse(FRIDAY_FILE); });
    const service = createService(fetchMock, "2026-10-12T09:00:00.000Z");
    await expect(service.getFxRate("USD", "CZK", "2026-10-09T20:00:00.000Z")).resolves.toMatchObject({ referenceDate: "2026-10-09" });
    expect(new URL(fetchMock.mock.calls[0][0].toString()).searchParams.get("date")).toBe("09.10.2026");
  });

  it("does not contact ČNB for CZK and returns 1", async () => {
    const fetchMock = vi.fn();
    await expect(createService(fetchMock, "2026-10-12T09:00:00.000Z").getFxRate("CZK", "CZK", "2026-10-12T09:00:00.000Z")).resolves.toMatchObject({ rate: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an unavailable rate instead of zero when ČNB fails, and logs it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => textResponse("down", 503));
    await expect(createService(fetchMock, "2026-10-12T09:00:00.000Z").getFxRate("USD", "CZK", "2026-10-12T09:00:00.000Z"))
      .rejects.toMatchObject({ code: "ProviderUnavailable" });
    expect(consoleError).toHaveBeenCalledWith("[market-data:cnb]", "ProviderUnavailable", expect.any(String), expect.objectContaining({ status: 503 }), "");
    consoleError.mockRestore();
  });
});
