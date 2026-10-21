import { describe, expect, it, vi } from "vitest";

import { InMemoryMarketDataCache } from "../cache";
import { createMarketDataService } from "../composition";
import type { Currency } from "../contracts";
import { FIXTURE_RETRIEVED_AT } from "../deterministic/fixtures";
import { FrankfurterClient } from "./client";
import { FrankfurterFxProvider } from "./provider";

const NOW = "2026-09-20T12:00:00.000Z";
const AS_OF = "2026-09-20T11:55:00.000Z";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function createService(fetchImplementation: typeof fetch, clock = () => new Date(NOW)) {
  return createMarketDataService({
    provider: "deterministic",
    fxProvider: "frankfurter",
    frankfurterFetch: fetchImplementation,
    clock,
  });
}

describe("Frankfurter v2 FX normalization", () => {
  it.each([
    ["USD", 20.9],
    ["EUR", 24.4],
  ] as const)("normalizes direct %s/CZK reference rates without inversion", async (baseCurrency, rate) => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      void input;
      return jsonResponse({ date: "2026-09-19", base: baseCurrency, quote: "CZK", rate });
    });
    const normalized = await createService(fetchMock).getFxRate(baseCurrency, "CZK", AS_OF);

    expect(normalized).toEqual(expect.objectContaining({
      baseCurrency,
      quoteCurrency: "CZK",
      rate,
      referenceDate: "2026-09-19",
      provenance: expect.objectContaining({
        provider: "frankfurter",
        dataset: "v2/rate:blended-reference",
        dataKind: "reference",
        referenceDate: "2026-09-19",
      }),
    }));
    const requestedUrl = new URL(fetchMock.mock.calls[0][0].toString());
    expect(requestedUrl.pathname).toBe(`/v2/rate/${baseCurrency}/CZK`);
    expect(normalized.rate).toBe(rate);
  });

  it("returns identity conversion without contacting Frankfurter", async () => {
    const fetchMock = vi.fn();
    await expect(createService(fetchMock).getFxRate("CZK", "CZK", AS_OF)).resolves.toMatchObject({
      rate: 1,
      referenceDate: "2026-09-20",
      provenance: { provider: "investi-identity", dataset: "identity" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves a provider date without fabricating an intraday observation", async () => {
    const rate = await createService(async () => jsonResponse({ date: "2026-09-18", base: "USD", quote: "CZK", rate: 20.9 }))
      .getFxRate("USD", "CZK", AS_OF);
    expect(rate.referenceDate).toBe("2026-09-18");
    expect(rate.provenance.referenceDate).toBe("2026-09-18");
    expect(rate).not.toHaveProperty("observedAt");
    expect(rate.provenance).not.toHaveProperty("observedAt");
  });

  it.each([
    [{}, "malformed-response"],
    [{ date: "2026-02-30", base: "USD", quote: "CZK", rate: 20.9 }, "invalid-reference-date"],
    [{ date: "2026-09-19", base: "USD", quote: "CZK", rate: 0 }, "malformed-response"],
    [{ date: "2026-09-19", base: "USD", quote: "CZK", rate: -1 }, "malformed-response"],
  ])("rejects malformed, invalid-date, zero, and negative responses", async (payload, reason) => {
    await expect(createService(async () => jsonResponse(payload)).getFxRate("USD", "CZK", AS_OF)).rejects.toMatchObject({
      code: "MalformedProviderResponse",
      context: { reason },
    });
  });

  it("rejects non-finite JSON rather than accepting it as a rate", async () => {
    const response = new Response('{"date":"2026-09-19","base":"USD","quote":"CZK","rate":NaN}', { status: 200 });
    await expect(createService(async () => response).getFxRate("USD", "CZK", AS_OF)).rejects.toMatchObject({ code: "MalformedProviderResponse" });
  });

  it("rejects a response whose pair does not exactly match the request", async () => {
    await expect(createService(async () => jsonResponse({ date: "2026-09-19", base: "CZK", quote: "USD", rate: 0.0478 }))
      .getFxRate("USD", "CZK", AS_OF)).rejects.toMatchObject({
      code: "MalformedProviderResponse",
      context: { reason: "pair-mismatch" },
    });
  });

  it("rejects unsupported Investník currencies before HTTP", async () => {
    const fetchMock = vi.fn();
    const provider = new FrankfurterFxProvider(new FrankfurterClient({ fetch: fetchMock }), () => new Date(NOW));
    await expect(provider.getFxRate("GBP" as Currency, "CZK", AS_OF)).rejects.toMatchObject({
      code: "FxUnavailable",
      context: { reason: "unsupported-currency" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Frankfurter failure normalization", () => {
  it.each([400, 404, 422])("maps HTTP %s to an unavailable pair", async (status) => {
    await expect(createService(async () => jsonResponse({ message: "missing" }, status)).getFxRate("USD", "CZK", AS_OF)).rejects.toMatchObject({
      code: "FxUnavailable",
      context: { status, reason: "unsupported-pair" },
    });
  });

  it("keeps rate limiting and upstream failure distinct", async () => {
    await expect(createService(async () => jsonResponse({ message: "slow down" }, 429)).getFxRate("USD", "CZK", AS_OF)).rejects.toMatchObject({ code: "RateLimited" });
    await expect(createService(async () => jsonResponse({ message: "down" }, 503)).getFxRate("USD", "CZK", AS_OF)).rejects.toMatchObject({ code: "ProviderUnavailable" });
  });

  it("normalizes network failures without leaking the raw exception", async () => {
    await expect(createService(async () => { throw new Error("socket detail"); }).getFxRate("USD", "CZK", AS_OF)).rejects.toMatchObject({
      code: "ProviderUnavailable",
      message: "Frankfurter could not be reached.",
    });
  });
});

describe("Frankfurter cache and composition", () => {
  it("uses the one-hour reference-rate TTL with an injected clock", async () => {
    let now = Date.parse(NOW);
    const fetchMock = vi.fn(async () => jsonResponse({ date: "2026-09-19", base: "USD", quote: "CZK", rate: 20.9 }));
    const service = createService(fetchMock, () => new Date(now));
    await service.getFxRate("USD", "CZK", AS_OF);
    now += 59 * 60 * 1_000;
    await service.getFxRate("USD", "CZK", AS_OF);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now += 2 * 60 * 1_000;
    await service.getFxRate("USD", "CZK", AS_OF);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("isolates FX cache entries by provider identity", async () => {
    const cache = new InMemoryMarketDataCache();
    const frankfurter = createMarketDataService({
      provider: "deterministic",
      fxProvider: "frankfurter",
      cache,
      clock: () => new Date(FIXTURE_RETRIEVED_AT),
      frankfurterFetch: async () => jsonResponse({ date: "2026-01-16", base: "USD", quote: "CZK", rate: 20.9 }),
    });
    const deterministic = createMarketDataService({
      provider: "deterministic",
      fxProvider: "deterministic",
      cache,
      clock: () => new Date(FIXTURE_RETRIEVED_AT),
    });
    await expect(frankfurter.getFxRate("USD", "CZK", FIXTURE_RETRIEVED_AT)).resolves.toMatchObject({ rate: 20.9, provenance: { provider: "frankfurter" } });
    await expect(deterministic.getFxRate("USD", "CZK", FIXTURE_RETRIEVED_AT)).resolves.toMatchObject({ rate: 22.75, provenance: { provider: "investi-deterministic" } });
  });

  it("coalesces simultaneous requests and does not require an API key", async () => {
    const fetchMock = vi.fn(async () => {
      await Promise.resolve();
      return jsonResponse({ date: "2026-09-19", base: "USD", quote: "CZK", rate: 20.9 });
    });
    const service = createService(fetchMock);
    const [first, second] = await Promise.all([
      service.getFxRate("USD", "CZK", AS_OF),
      service.getFxRate("USD", "CZK", AS_OF),
    ]);
    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache provider failures as valid reference rates", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: "down" }, 503))
      .mockResolvedValueOnce(jsonResponse({ date: "2026-09-19", base: "USD", quote: "CZK", rate: 20.9 }));
    const service = createService(fetchMock);
    await expect(service.getFxRate("USD", "CZK", AS_OF)).rejects.toMatchObject({ code: "ProviderUnavailable" });
    await expect(service.getFxRate("USD", "CZK", AS_OF)).resolves.toMatchObject({ rate: 20.9 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
