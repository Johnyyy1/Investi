import { describe, expect, it, vi } from "vitest";

import { adjustmentPolicies, type HistoricalPriceRequest } from "../contracts";
import { MarketDataService } from "../service";
import { FmpClient, type FmpFetch } from "./client";
import { FmpMarketDataProvider } from "./provider";

const AAPL = "FMP:NASDAQ:AAPL";
const RETRIEVED_AT = "2026-09-19T12:00:00.000Z";
const QUOTE_OBSERVED_AT = "2026-09-19T11:55:00.000Z";

const profilePayload = [{
  symbol: "AAPL",
  companyName: "Apple Inc.",
  currency: "USD",
  exchange: "NASDAQ",
  isEtf: false,
  isFund: false,
  description: "An upstream-only field that must not leak into the Investník type.",
}];

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockedProvider(responses: readonly Response[]) {
  const fetchMock = vi.fn<FmpFetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  const client = new FmpClient({
    apiKey: "test-key-never-sent-to-fmp",
    baseUrl: "https://fmp.test/stable",
    fetch: fetchMock,
  });
  return {
    fetchMock,
    provider: new FmpMarketDataProvider(client, () => new Date(RETRIEVED_AT)),
  };
}

function historyRequest(adjustment: HistoricalPriceRequest["adjustment"] = adjustmentPolicies["split-adjusted"]): HistoricalPriceRequest {
  return {
    instrumentId: AAPL,
    startDate: "2026-09-17",
    endDate: "2026-09-19",
    interval: "daily",
    timeZone: "UTC",
    adjustment,
  };
}

describe("Financial Modeling Prep configuration and HTTP boundary", () => {
  it("fails explicitly when the API key is missing", () => {
    expect(() => new FmpClient({ apiKey: "  " })).toThrowError(expect.objectContaining({
      name: "MarketDataError",
      code: "ProviderConfiguration",
      context: expect.objectContaining({ reason: "missing-api-key" }),
    }));
  });

  it("keeps the API key out of the URL and sends it only in a server request header", async () => {
    const { fetchMock, provider } = mockedProvider([jsonResponse(profilePayload)]);

    await provider.getInstrumentMetadata(AAPL);

    const [request, init] = fetchMock.mock.calls[0];
    const url = new URL(request instanceof Request ? request.url : request.toString());
    expect(url.pathname).toBe("/stable/profile");
    expect(url.searchParams.get("symbol")).toBe("AAPL");
    expect(url.searchParams.has("apikey")).toBe(false);
    expect(new Headers(init?.headers).get("apikey")).toBe("test-key-never-sent-to-fmp");
  });

  it("turns non-2xx and rate-limit responses into explicit normalized errors", async () => {
    const unavailable = mockedProvider([jsonResponse({ message: "down" }, 503)]).provider;
    await expect(unavailable.getInstrumentMetadata(AAPL)).rejects.toMatchObject({
      code: "ProviderUnavailable",
      context: { endpoint: "profile", status: 503 },
    });

    const limited = mockedProvider([jsonResponse({ message: "slow down" }, 429)]).provider;
    await expect(limited.getInstrumentMetadata(AAPL)).rejects.toMatchObject({
      code: "RateLimited",
      context: { endpoint: "profile", status: 429 },
    });

    const planLimited = mockedProvider([jsonResponse({ message: "upgrade" }, 402)]).provider;
    await expect(planLimited.getInstrumentMetadata(AAPL)).rejects.toMatchObject({
      code: "ProviderConfiguration",
      context: { endpoint: "profile", status: 402, reason: "plan-entitlement" },
    });
  });

  it("rejects provider error payloads returned with a successful HTTP status", async () => {
    const { provider } = mockedProvider([jsonResponse({ "Error Message": "Invalid API KEY." })]);

    await expect(provider.getInstrumentMetadata(AAPL)).rejects.toMatchObject({
      code: "ProviderAuthentication",
      context: expect.objectContaining({ endpoint: "profile", operation: "response" }),
    });
  });
});

describe("Financial Modeling Prep instrument search", () => {
  const searchPayload = [
    { symbol: "AAPL", name: "Apple Inc.", currency: "USD", exchange: "NASDAQ", exchangeFullName: "NASDAQ Global Select" },
    { symbol: "APLE", name: "Apple Hospitality REIT, Inc.", currency: "USD", exchange: "NYSE", exchangeFullName: "New York Stock Exchange" },
    { symbol: "AAPL", name: "Apple Inc.", currency: "USD", exchange: "NASDAQ", exchangeFullName: "NASDAQ Global Select" },
  ];

  it("normalizes exact-ticker and company-name searches with stable ranking and deduplication", async () => {
    const ticker = mockedProvider([jsonResponse(searchPayload)]);
    const tickerResults = await ticker.provider.searchInstruments(" AAPL ");
    expect(tickerResults).toEqual([
      {
        instrumentId: "FMP:NASDAQ:AAPL",
        symbol: "AAPL",
        name: "Apple Inc.",
        assetType: null,
        exchangeMic: "XNAS",
        exchangeCode: "NASDAQ",
        quoteCurrency: "USD",
        provider: "financial-modeling-prep",
        providerSymbol: "AAPL",
      },
      expect.objectContaining({ instrumentId: "FMP:NYSE:APLE", symbol: "APLE" }),
    ]);
    expect(new URL(ticker.fetchMock.mock.calls[0][0].toString()).searchParams.get("query")).toBe("aapl");

    const company = mockedProvider([jsonResponse(searchPayload)]).provider;
    expect((await company.searchInstruments("apple hospitality"))[0]).toMatchObject({ symbol: "APLE", name: "Apple Hospitality REIT, Inc." });
  });

  it("keeps the same symbol on different exchanges as distinct instruments", async () => {
    const { provider } = mockedProvider([jsonResponse([
      { symbol: "ABC", name: "ABC US", currency: "USD", exchange: "NASDAQ", exchangeFullName: "NASDAQ" },
      { symbol: "ABC", name: "ABC Europe", currency: "EUR", exchange: "XETRA", exchangeFullName: "Deutsche Boerse Xetra" },
    ])]);

    expect((await provider.searchInstruments("abc")).map(({ instrumentId }) => instrumentId)).toEqual([
      "FMP:XETRA:ABC",
      "FMP:NASDAQ:ABC",
    ]);
  });

  it("distinguishes empty results from malformed and upstream failures", async () => {
    await expect(mockedProvider([jsonResponse([])]).provider.searchInstruments("missing")).resolves.toEqual([]);
    await expect(mockedProvider([jsonResponse([{ symbol: "AAPL" }])]).provider.searchInstruments("aapl")).rejects.toMatchObject({
      code: "MalformedProviderResponse",
    });
    await expect(mockedProvider([jsonResponse({ message: "down" }, 503)]).provider.searchInstruments("aapl")).rejects.toMatchObject({
      code: "ProviderUnavailable",
    });
  });
});

describe("Financial Modeling Prep normalization", () => {
  it("normalizes a Stable profile into an Investník instrument", async () => {
    const { provider } = mockedProvider([jsonResponse(profilePayload)]);

    await expect(provider.getInstrumentMetadata(AAPL)).resolves.toEqual({
      instrumentId: AAPL,
      symbol: "AAPL",
      name: "Apple Inc.",
      assetType: "equity",
      exchangeMic: "XNAS",
      quoteCurrency: "USD",
      equityProfile: { sector: null, industry: null, country: null, marketCap: null },
    });
  });

  it("reuses normalized company classification and market cap from the cached profile", async () => {
    const { provider } = mockedProvider([jsonResponse([{ ...profilePayload[0], sector: "Technology", industry: "Devices", country: "US", marketCap: 3_420_000_000_000 }])]);
    await expect(provider.getInstrumentMetadata(AAPL)).resolves.toMatchObject({
      equityProfile: { sector: "Technology", industry: "Devices", country: "US", marketCap: 3_420_000_000_000 },
    });
  });

  it("normalizes the quote price as the provider's last price with its observation timestamp", async () => {
    const unixSeconds = Date.parse(QUOTE_OBSERVED_AT) / 1_000;
    const { provider } = mockedProvider([
      jsonResponse([{ symbol: "AAPL", price: 245.5, timestamp: unixSeconds, bid: 245.4, ask: 245.6 }]),
      jsonResponse(profilePayload),
    ]);

    const quote = await provider.getQuote(AAPL);

    expect(quote).toEqual({
      instrumentId: AAPL,
      price: 245.5,
      currency: "USD",
      observedAt: QUOTE_OBSERVED_AT,
      retrievedAt: RETRIEVED_AT,
      provenance: {
        provider: "financial-modeling-prep",
        dataset: "stable/quote",
        dataKind: "live",
        isDeterministic: false,
        isDemo: false,
        observedAt: QUOTE_OBSERVED_AT,
        retrievedAt: RETRIEVED_AT,
        adjustmentMode: null,
        completeness: "complete",
      },
    });
    expect(quote.price).not.toBe(245.4);
    expect(quote.price).not.toBe(245.6);
  });

  it("normalizes and chronologically sorts newest-first split-adjusted EOD observations", async () => {
    const { fetchMock, provider } = mockedProvider([
      jsonResponse([
        { symbol: "AAPL", date: "2026-09-19", open: 244, high: 247, low: 243, close: 246, volume: 1_200 },
        { symbol: "AAPL", date: "2026-09-17", open: 240, high: 243, low: 239, close: 242, volume: 1_000 },
        { symbol: "AAPL", date: "2026-09-18", open: 242, high: 245, low: 241, close: 244, volume: 1_100 },
      ]),
      jsonResponse(profilePayload),
    ]);

    const series = await provider.getHistoricalPrices(historyRequest());

    expect(series.points.map(({ date }) => date)).toEqual(["2026-09-17", "2026-09-18", "2026-09-19"]);
    expect(series.points.map(({ close }) => close)).toEqual([242, 244, 246]);
    expect(series.points.every((point) => point.adjustedClose === undefined)).toBe(true);
    expect(series).toMatchObject({
      instrumentId: AAPL,
      currency: "USD",
      interval: "daily",
      timeZone: "UTC",
      adjustment: adjustmentPolicies["split-adjusted"],
      provenance: {
        provider: "financial-modeling-prep",
        dataset: "stable/historical-price-eod/full",
        dataKind: "historical",
        adjustmentMode: "split-adjusted",
        observedAt: "2026-09-19T00:00:00.000Z",
      },
    });
    const historyUrl = new URL(fetchMock.mock.calls[0][0].toString());
    expect(historyUrl.pathname).toBe("/stable/historical-price-eod/full");
    expect(Object.fromEntries(historyUrl.searchParams)).toEqual({ symbol: "AAPL", from: "2026-09-17", to: "2026-09-19" });
  });

  it("pages backwards past FMP's 5,000-row cap so a long range keeps its oldest observations", async () => {
    const day = (offset: number) => new Date(Date.UTC(2026, 8, 19) - offset * 86_400_000).toISOString().slice(0, 10);
    const row = (date: string) => ({ symbol: "AAPL", date, open: 10, high: 11, low: 9, close: 10.5, volume: 1 });
    const newest = Array.from({ length: 5_000 }, (_, index) => row(day(index)));
    const older = [row(day(5_000)), row(day(5_001))];
    const { fetchMock, provider } = mockedProvider([jsonResponse(newest), jsonResponse(older), jsonResponse(profilePayload)]);

    const series = await provider.getHistoricalPrices({ ...historyRequest(), startDate: "1900-01-01" });

    expect(series.points).toHaveLength(5_002);
    expect(series.points[0].date).toBe(day(5_001));
    expect(series.points.at(-1)?.date).toBe("2026-09-19");
    expect(series.provenance.completeness).toBe("complete");
    const pages = fetchMock.mock.calls.slice(0, 2).map(([url]) => Object.fromEntries(new URL(url.toString()).searchParams));
    expect(pages).toEqual([
      { symbol: "AAPL", from: "1900-01-01", to: "2026-09-19" },
      { symbol: "AAPL", from: "1900-01-01", to: day(5_000) },
    ]);
  });

  it("does not request older pages when the response is below the cap", async () => {
    const { fetchMock, provider } = mockedProvider([
      jsonResponse([{ symbol: "AAPL", date: "2026-09-18", open: 242, high: 245, low: 241, close: 244, volume: 1 }]),
      jsonResponse(profilePayload),
    ]);
    await provider.getHistoricalPrices({ ...historyRequest(), startDate: "1900-01-01" });
    expect(fetchMock.mock.calls.filter(([url]) => url.toString().includes("historical-price-eod"))).toHaveLength(1);
  });

  it("uses FMP's non-split-adjusted Stable endpoint for raw closes", async () => {
    const { fetchMock, provider } = mockedProvider([
      jsonResponse([{ symbol: "AAPL", date: "2026-09-19", open: 244, high: 247, low: 243, close: 246, volume: 1_200 }]),
      jsonResponse(profilePayload),
    ]);

    const series = await provider.getHistoricalPrices(historyRequest(adjustmentPolicies.raw));

    expect(series.points[0]).not.toHaveProperty("adjustedClose");
    expect(series.provenance.adjustmentMode).toBe("raw");
    expect(new URL(fetchMock.mock.calls[0][0].toString()).pathname).toBe("/stable/historical-price-eod/non-split-adjusted");
  });
});

describe("Financial Modeling Prep response validation", () => {
  it("handles an empty quote response explicitly without requesting fake or profile data", async () => {
    const { fetchMock, provider } = mockedProvider([jsonResponse([])]);

    await expect(provider.getQuote(AAPL)).rejects.toMatchObject({ code: "QuoteUnavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed quote and historical responses at the provider boundary", async () => {
    const malformedQuote = mockedProvider([jsonResponse([{ symbol: "AAPL", price: "245.5", timestamp: 1_790_000_000 }])]).provider;
    await expect(malformedQuote.getQuote(AAPL)).rejects.toMatchObject({
      code: "MalformedProviderResponse",
      context: expect.objectContaining({ endpoint: "quote", reason: "malformed-response" }),
    });
    const zeroQuote = mockedProvider([jsonResponse([{ symbol: "AAPL", price: 0, timestamp: 1_790_000_000 }])]).provider;
    await expect(zeroQuote.getQuote(AAPL)).rejects.toMatchObject({ code: "MalformedProviderResponse" });

    const malformedHistory = mockedProvider([jsonResponse([
      { symbol: "AAPL", date: "2026-02-30", open: 10, high: 12, low: 9, close: 11, volume: 100 },
    ])]).provider;
    await expect(malformedHistory.getHistoricalPrices(historyRequest())).rejects.toMatchObject({
      code: "MalformedProviderResponse",
      context: expect.objectContaining({ endpoint: "historical-price-eod/full", reason: "invalid-date" }),
    });
  });

  it("does not claim dividend-adjusted data satisfies Investník's total-return policy", async () => {
    const { fetchMock, provider } = mockedProvider([]);

    await expect(provider.getHistoricalPrices(historyRequest(adjustmentPolicies["total-return"]))).rejects.toMatchObject({
      code: "UnsupportedAdjustment",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Financial Modeling Prep CZK FX", () => {
  it.each([
    ["USD", "USDCZK", 22.75],
    ["EUR", "EURCZK", 24.9],
  ] as const)("normalizes direct %s/CZK quotes without inversion", async (baseCurrency, pair, price) => {
    const observedAt = "2026-09-19T11:55:00.000Z";
    const { fetchMock, provider } = mockedProvider([
      jsonResponse([{ symbol: pair, price, timestamp: Date.parse(observedAt) / 1_000 }]),
    ]);

    await expect(provider.getFxRate(baseCurrency, "CZK", RETRIEVED_AT)).resolves.toMatchObject({
      baseCurrency,
      quoteCurrency: "CZK",
      rate: price,
      referenceDate: observedAt.slice(0, 10),
      provenance: { dataset: "stable/quote:forex" },
    });
    expect(new URL(fetchMock.mock.calls[0][0].toString()).searchParams.get("symbol")).toBe(pair);
  });

  it("returns the CZK identity rate without contacting FMP", async () => {
    const { fetchMock, provider } = mockedProvider([]);
    await expect(provider.getFxRate("CZK", "CZK", RETRIEVED_AT)).resolves.toMatchObject({ rate: 1, provenance: { dataset: "identity" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unavailable, malformed, and failed FX responses explicitly", async () => {
    await expect(mockedProvider([jsonResponse([])]).provider.getFxRate("USD", "CZK", RETRIEVED_AT)).rejects.toMatchObject({ code: "FxUnavailable" });
    await expect(mockedProvider([jsonResponse([{ symbol: "USDCZK", price: 0, timestamp: Date.parse(RETRIEVED_AT) / 1_000 }])]).provider.getFxRate("USD", "CZK", RETRIEVED_AT)).rejects.toMatchObject({ code: "MalformedProviderResponse" });
    await expect(mockedProvider([jsonResponse({ message: "down" }, 503)]).provider.getFxRate("USD", "CZK", RETRIEVED_AT)).rejects.toMatchObject({ code: "ProviderUnavailable" });
  });

  it("rejects an otherwise valid FX quote when it is stale for the requested observation", async () => {
    const { provider } = mockedProvider([
      jsonResponse([{ symbol: "USDCZK", price: 22.75, timestamp: Date.parse("2026-09-10T11:55:00.000Z") / 1_000 }]),
    ]);
    const service = new MarketDataService(provider, { clock: () => new Date(RETRIEVED_AT) });

    await expect(service.getFxRate("USD", "CZK", RETRIEVED_AT)).rejects.toMatchObject({ code: "FxUnavailable" });
  });
});
