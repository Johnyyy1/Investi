/**
 * HTTP security headers.
 *
 * The static set is attached to every response in next.config.ts. The Content-Security-Policy
 * needs a fresh nonce per document, so src/proxy.ts builds it per request; Next.js reads the
 * nonce from the request header and attaches it to its own scripts.
 */

export type SecurityHeader = { key: string; value: string };

export const staticSecurityHeaders: SecurityHeader[] = [
  // Legacy clickjacking guard for browsers that ignore CSP frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // No bluetooth=(): Chrome does not recognize it and logs a console error on every page.
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), browsing-topics=()",
  },
];

/** Responses that are never rendered as a page (API routes) may load nothing at all. */
export const apiContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export function createNonce(): string {
  return btoa(crypto.randomUUID());
}

export function contentSecurityPolicy({ nonce, development }: { nonce: string; development: boolean }): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced Next.js runtime load its chunks. React needs eval only in development.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Style attributes from React, Motion, Recharts and KaTeX markup cannot carry a nonce.
    // A nonce here would also make browsers ignore 'unsafe-inline'.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** CSP_REPORT_ONLY=true sends the policy as Report-Only, a rollback lever that keeps reporting violations. */
export function contentSecurityPolicyHeaderName(reportOnly: string | undefined): string {
  return reportOnly === "true" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
}
