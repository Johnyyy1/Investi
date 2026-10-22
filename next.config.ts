import type { NextConfig } from "next";
import { apiContentSecurityPolicy, staticSecurityHeaders } from "./src/lib/security-headers";
import { canonicalHostRedirects } from "./src/lib/site";

const nextConfig: NextConfig = {
  async redirects() {
    return canonicalHostRedirects;
  },
  async headers() {
    return [
      { source: "/:path*", headers: staticSecurityHeaders },
      { source: "/reset-password", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/verify-email", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/api/auth/verify-email", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/api/auth/reset-password/:token", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      // Pages get a per-request nonce policy from src/proxy.ts.
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: apiContentSecurityPolicy }] },
    ];
  },
};

export default nextConfig;
