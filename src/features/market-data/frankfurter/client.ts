import "server-only";

import { MarketDataError } from "../errors";

export const FRANKFURTER_PROVIDER_ID = "frankfurter";
export const FRANKFURTER_BASE_URL = "https://api.frankfurter.dev";

export type FrankfurterFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface FrankfurterClientOptions {
  baseUrl?: string;
  fetch?: FrankfurterFetch;
}

function providerFailure(message: string, context: Record<string, string | number>, cause?: unknown) {
  return new MarketDataError("ProviderUnavailable", message, {
    provider: FRANKFURTER_PROVIDER_ID,
    ...context,
  }, cause === undefined ? undefined : { cause });
}

/** Minimal no-credential HTTP boundary for Frankfurter API v2. */
export class FrankfurterClient {
  private readonly baseUrl: string;
  private readonly fetchImplementation: FrankfurterFetch;

  constructor(options: FrankfurterClientOptions = {}) {
    const baseUrl = options.baseUrl ?? FRANKFURTER_BASE_URL;
    let parsedBaseUrl: URL;
    try {
      parsedBaseUrl = new URL(baseUrl);
    } catch (error) {
      throw new MarketDataError("ProviderConfiguration", "The Frankfurter base URL is invalid.", {
        provider: FRANKFURTER_PROVIDER_ID,
        operation: "configuration",
        reason: "invalid-base-url",
      }, { cause: error });
    }
    if (!/^https?:$/.test(parsedBaseUrl.protocol)) {
      throw new MarketDataError("ProviderConfiguration", "The Frankfurter base URL must use HTTP or HTTPS.", {
        provider: FRANKFURTER_PROVIDER_ID,
        operation: "configuration",
        reason: "invalid-base-url",
      });
    }
    this.baseUrl = parsedBaseUrl.toString().replace(/\/$/, "");
    this.fetchImplementation = options.fetch ?? fetch;
  }

  async getRate(baseCurrency: string, quoteCurrency: string, date?: string): Promise<unknown> {
    // Without a date Frankfurter answers with today's rate, which is newer than an earlier quote observation.
    const endpoint = `v2/rate/${encodeURIComponent(baseCurrency)}/${encodeURIComponent(quoteCurrency)}${date ? `?date=${encodeURIComponent(date)}` : ""}`;
    let response: Response;
    try {
      response = await this.fetchImplementation(`${this.baseUrl}/${endpoint}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
    } catch (error) {
      throw providerFailure("Frankfurter could not be reached.", { operation: "request", endpoint: "v2/rate" }, error);
    }

    if (!response.ok) {
      const unavailablePair = response.status === 400 || response.status === 404 || response.status === 422;
      const code = unavailablePair ? "FxUnavailable" : response.status === 429 ? "RateLimited" : "ProviderUnavailable";
      throw new MarketDataError(code, unavailablePair
        ? "Frankfurter does not provide the requested FX pair."
        : response.status === 429
          ? "Frankfurter rate-limited the request."
          : "Frankfurter returned an unsuccessful response.", {
        provider: FRANKFURTER_PROVIDER_ID,
        operation: "request",
        endpoint: "v2/rate",
        status: response.status,
        ...(unavailablePair ? { reason: "unsupported-pair" } : {}),
      });
    }

    try {
      return await response.json();
    } catch (error) {
      throw new MarketDataError("MalformedProviderResponse", "Frankfurter returned invalid JSON.", {
        provider: FRANKFURTER_PROVIDER_ID,
        operation: "response",
        endpoint: "v2/rate",
      }, { cause: error });
    }
  }
}
