import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, contentSecurityPolicyHeaderName, createNonce } from "@/lib/security-headers";

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const policy = contentSecurityPolicy({ nonce, development: process.env.NODE_ENV === "development" });

  // Next.js extracts the nonce from this request header while rendering.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(contentSecurityPolicyHeaderName(process.env.CSP_REPORT_ONLY), policy);
  return response;
}

export const config = {
  matcher: [
    {
      // API routes get a static policy from next.config.ts; build assets need none.
      source: "/((?!api/|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
