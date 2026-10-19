/** Optional live check. No credentials, prices, history or flows endpoints. */
import assert from "node:assert/strict";
import type { Instrument } from "../src/features/market-data/contracts";
import { TickerInsideEtfAnalyticsProvider } from "../src/features/market-data/tickerinside/etf-analytics";

const calls: string[] = [];
const provider = new TickerInsideEtfAnalyticsProvider({ fetch: async (input, init) => {
  calls.push(input.toString());
  return fetch(input, init);
} });

for (const symbol of ["SPY", "VOO", "IVV", "QQQ", "VTI"]) {
  const nasdaq = symbol === "QQQ";
  const instrument: Instrument = { instrumentId: `FMP:${nasdaq ? "NASDAQ" : "AMEX"}:${symbol}`, symbol, name: symbol, assetType: "etf", exchangeMic: nasdaq ? "XNAS" : "XASE", quoteCurrency: "USD" };
  const methods = ["getEtfInfo", "getEtfHoldings", "getEtfSectors", "getEtfCountries"] as const;
  const results = await Promise.allSettled(methods.map((method) => provider[method](instrument)));
  const info = results[0];
  const holdings = results[1];
  assert.equal(info.status, "fulfilled", `${symbol}: info must be available`);
  assert.equal(holdings.status, "fulfilled", `${symbol}: holdings must be available`);
  if (info.status === "fulfilled") assert.equal(info.value.provider, "tickerinside");
  assert.equal(calls.filter((url) => url.endsWith(`/${symbol.toLowerCase()}.json`)).length, 1, "four views must share one HTTP request");
  console.log(JSON.stringify({ symbol, datasets: results.map((result, index) => ({
    name: methods[index],
    ...(result.status === "fulfilled" ? {
      asOf: result.value.asOf, retrievedAt: result.value.retrievedAt, completeness: result.value.completeness,
      source: result.value.source, value: methods[index] === "getEtfInfo" ? result.value.value : undefined,
      coverage: result.value.coverage,
    } : { unavailable: true, code: result.reason?.code }),
  })) }, null, 2));
}
console.log(`PASS: ${calls.length} current fund snapshots; no API key required.`);
