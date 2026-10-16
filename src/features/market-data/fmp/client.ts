import "server-only";

import { MarketDataError } from "../errors";

export const FMP_PROVIDER_ID = "financial-modeling-prep";
export const FMP_STABLE_BASE_URL = "https://financialmodelingprep.com/stable";

export type FmpFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface FmpClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetch?: FmpFetch;
}

function providerFailure(message: string, context: Record<string, string | number>, cause?: unknown) {
  return new MarketDataError("ProviderUnavailable", message, {
    provider: FMP_PROVIDER_ID,
    ...context,
  }, cause === undefined ? undefined : { cause });
}

function providerErrorPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return ["Error Message", "error", "message"]
    .map((key) => record[key])
    .find((message): message is string => typeof message === "string");
}

/** Minimal HTTP boundary for FMP's Stable API. It never places the API key in the URL. */
export class FmpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImplementation: FmpFetch;

  constructor(options: FmpClientOptions) {
    const apiKey = options.apiKey?.trim();
    if (!apiKey) {
      throw new MarketDataError("ProviderConfiguration", "FMP_API_KEY is required to use Financial Modeling Prep market data.", {
        provider: FMP_PROVIDER_ID,
        operation: "configuration",
        reason: "missing-api-key",
      });
    }

    const baseUrl = options.baseUrl ?? FMP_STABLE_BASE_URL;
    let parsedBaseUrl: URL;
    try {
      parsedBaseUrl = new URL(baseUrl);
    } catch (error) {
      throw new MarketDataError("ProviderConfiguration", "The Financial Modeling Prep base URL is invalid.", {
        provider: FMP_PROVIDER_ID,
        operation: "configuration",
        reason: "invalid-base-url",
      }, { cause: error });
    }
    if (!/^https?:$/.test(parsedBaseUrl.protocol)) {
      throw new MarketDataError("ProviderConfiguration", "The Financial Modeling Prep base URL must use HTTP or HTTPS.", {
        provider: FMP_PROVIDER_ID,
        operation: "configuration",
        reason: "invalid-base-url",
      });
    }

    this.apiKey = apiKey;
    this.baseUrl = parsedBaseUrl.toString().replace(/\/$/, "");
    this.fetchImplementation = options.fetch ?? fetch;
  }

  async get(path: string, parameters: Readonly<Record<string, string>>): Promise<unknown> {
    const endpoint = path.replace(/^\/+/, "");
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          apikey: this.apiKey,
        },
        cache: "no-store",
      });
    } catch (error) {
      throw providerFailure("Financial Modeling Prep could not be reached.", {
        operation: "request",
        endpoint,
      }, error);
    }

    if (!response.ok) {
      const authenticationFailure = response.status === 401 || response.status === 403;
      const entitlementFailure = response.status === 402;
      const code = authenticationFailure
        ? "ProviderAuthentication"
        : entitlementFailure
          ? "ProviderConfiguration"
          : response.status === 429 ? "RateLimited" : "ProviderUnavailable";
      // Quota exhaustion affects every learner, so it is worth an alert. Only the endpoint path is
      // logged: query parameters can carry learner search text and the key travels in a header.
      if (response.status === 429) console.warn(`[investi:market-data] ${JSON.stringify({ event: "provider-rate-limited", provider: FMP_PROVIDER_ID, endpoint, status: 429 })}`);
      throw new MarketDataError(code, authenticationFailure
        ? "Financial Modeling Prep rejected the configured credentials."
        : entitlementFailure
          ? "The configured Financial Modeling Prep plan does not permit this dataset."
          : response.status === 429
            ? "Financial Modeling Prep rate-limited the request."
            : "Financial Modeling Prep returned an unsuccessful response.", {
        provider: FMP_PROVIDER_ID,
        operation: "request",
        endpoint,
        status: response.status,
        ...(entitlementFailure ? { reason: "plan-entitlement" } : {}),
      });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new MarketDataError("MalformedProviderResponse", "Financial Modeling Prep returned invalid JSON.", {
        provider: FMP_PROVIDER_ID,
        operation: "response",
        endpoint,
      }, { cause: error });
    }

    const providerError = providerErrorPayload(payload);
    if (providerError) {
      const authenticationFailure = /api\s*key|apikey|credential|unauthori[sz]ed|forbidden/i.test(providerError);
      throw new MarketDataError(authenticationFailure ? "ProviderAuthentication" : "ProviderUnavailable", authenticationFailure
        ? "Financial Modeling Prep rejected the configured credentials."
        : "Financial Modeling Prep returned a provider error.", {
        provider: FMP_PROVIDER_ID,
        operation: "response",
        endpoint,
      });
    }
    return payload;
  }
}
