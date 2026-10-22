import { z } from "zod";
import { senderDomain } from "./config";

const domainPage = z.object({
  has_more: z.boolean().optional(),
  data: z.array(z.object({ id: z.string().min(1), name: z.string(), status: z.string() })),
});

/** Read-only release diagnostic. Errors contain no sender, credentials, or upstream response bodies. */
export async function checkEmailDomain({ apiKey, from, fetch: fetchImpl = fetch }: { apiKey: string; from: string; fetch?: typeof fetch }): Promise<void> {
  const domain = senderDomain(from);
  if (!domain || !apiKey.trim()) throw new Error("email:check requires RESEND_API_KEY and a valid EMAIL_FROM.");
  let cursor: string | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < 100; page++) {
    const url = new URL("https://api.resend.com/domains");
    if (cursor) url.searchParams.set("after", cursor);
    let response: Response;
    try {
      response = await fetchImpl(url, { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new Error("email:check could not reach Resend.");
    }
    if (!response.ok) throw new Error(`email:check: Resend domain lookup failed (HTTP ${response.status}). The check needs permission to list domains.`);
    const result = domainPage.safeParse(await response.json().catch(() => null));
    if (!result.success) throw new Error("email:check: invalid Resend domain response.");
    const match = result.data.data.find((entry) => entry.name.toLowerCase() === domain);
    if (match) {
      if (match.status !== "verified") throw new Error("email:check: EMAIL_FROM domain is not verified in Resend.");
      return;
    }
    if (!result.data.has_more) break;
    cursor = result.data.data.at(-1)?.id;
    if (!cursor || seen.has(cursor)) throw new Error("email:check: invalid Resend pagination.");
    seen.add(cursor);
  }
  throw new Error("email:check: EMAIL_FROM domain was not found among verified Resend domains.");
}
