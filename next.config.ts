import type { NextConfig } from "next";
import { apiContentSecurityPolicy, staticSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: staticSecurityHeaders },
      // Pages get a per-request nonce policy from src/proxy.ts.
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: apiContentSecurityPolicy }] },
    ];
  },
};

export default nextConfig;
