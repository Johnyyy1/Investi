import "server-only";

import { MarketDataError } from "../errors";
import { CNB_PROVIDER_ID } from "./parse";

export const CNB_DAILY_RATES_URL = "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt";
/** ČNB declares the fixing once per working day (~14:30 Prague), so an hour of reuse is safe. */
export const CNB_REVALIDATE_SECONDS = 60 * 60;

export type CnbFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface CnbClientOptions {
  url?: string;
  fetch?: CnbFetch;
}

function logged(error: MarketDataError, cause?: unknown) {
  console.error("[market-data:cnb]", error.code, error.message, error.context, cause ?? "");
  return error;
}

/** Keyless HTTP boundary for the ČNB daily fixing text file. */
export class CnbClient {
  private readonly url: string;
  private readonly fetchImplementation: CnbFetch;

  constructor(options: CnbClientOptions = {}) {
    this.url = options.url ?? CNB_DAILY_RATES_URL;
    this.fetchImplementation = options.fetch ?? fetch;
  }

  /**
   * Returns the fixing valid on `date` (YYYY-MM-DD). For weekends, holidays and
   * mornings before the declaration ČNB answers with the last declared fixing.
   */
  async getDailyRates(date: string): Promise<string> {
    const [year, month, day] = date.split("-");
    const url = new URL(this.url);
    url.searchParams.set("date", `${day}.${month}.${year}`);
    let response: Response;
    try {
      response = await this.fetchImplementation(url.toString(), {
        method: "GET",
        headers: { Accept: "text/plain" },
        next: { revalidate: CNB_REVALIDATE_SECONDS },
      } as RequestInit);
    } catch (error) {
      throw logged(new MarketDataError("ProviderUnavailable", "ČNB could not be reached.", {
        provider: CNB_PROVIDER_ID,
        operation: "request",
        date,
      }, { cause: error }), error);
    }
    if (!response.ok) {
      throw logged(new MarketDataError(response.status === 429 ? "RateLimited" : "ProviderUnavailable", "ČNB returned an unsuccessful response.", {
        provider: CNB_PROVIDER_ID,
        operation: "request",
        status: response.status,
        date,
      }));
    }
    try {
      return await response.text();
    } catch (error) {
      throw logged(new MarketDataError("MalformedProviderResponse", "ČNB returned an unreadable response.", {
        provider: CNB_PROVIDER_ID,
        operation: "response",
        date,
      }, { cause: error }), error);
    }
  }
}
