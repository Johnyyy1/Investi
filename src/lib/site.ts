/**
 * Brand name and canonical production origin (docs/brand.md). Metadata, structured data, the
 * manifest and e-mails read them here; auth keeps using BETTER_AUTH_URL, the origin it actually runs on.
 */
export const BRAND_NAME = "Investník";
export const SITE_URL = "https://investnik.cz";
export const SITE_HOST = new URL(SITE_URL).host;
export const SITE_DESCRIPTION = "Bezplatná výuka investování v češtině: krátké lekce, praktická cvičení a portfolio nanečisto bez skutečných peněz. Vzdělávání, ne investiční doporučení.";

/**
 * www.investnik.cz permanently redirects to the apex with its path and query (Next.js passes the query
 * through). The rule matches that one host only, so localhost and Vercel preview URLs are untouched.
 */
export const canonicalHostRedirects = [
  { source: "/:path*", has: [{ type: "host" as const, value: "www\\.investnik\\.cz" }], destination: `${SITE_URL}/:path*`, permanent: true },
];

/** Search engines may index production only; Vercel previews (VERCEL_ENV=preview) and development builds stay out. */
export function isIndexableDeployment(vercelEnv = process.env.VERCEL_ENV) {
  return vercelEnv === undefined || vercelEnv === "production";
}
