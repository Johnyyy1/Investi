import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { proxy } from "../proxy";
import { NextRequest } from "next/server";
import { apiContentSecurityPolicy, contentSecurityPolicy, contentSecurityPolicyHeaderName, createNonce, staticSecurityHeaders } from "./security-headers";

const directives = (policy: string) => new Map(policy.split("; ").map((directive) => {
  const [name, ...sources] = directive.split(" ");
  return [name, sources];
}));

describe("contentSecurityPolicy", () => {
  it("allows only nonced scripts and forbids framing, plugins and base rewrites", () => {
    const policy = directives(contentSecurityPolicy({ nonce: "abc123", development: false }));
    expect(policy.get("script-src")).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'self'"]);
    expect(policy.get("form-action")).toEqual(["'self'"]);
    expect(policy.get("default-src")).toEqual(["'self'"]);
  });

  it("never allows inline or evaluated scripts in production", () => {
    const scripts = directives(contentSecurityPolicy({ nonce: "n", development: false })).get("script-src");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it("adds eval only for React's development tooling", () => {
    expect(directives(contentSecurityPolicy({ nonce: "n", development: true })).get("script-src")).toContain("'unsafe-eval'");
  });

  it("keeps inline style attributes working without a style nonce that would disable them", () => {
    const styles = directives(contentSecurityPolicy({ nonce: "n", development: false })).get("style-src") ?? [];
    expect(styles).toContain("'unsafe-inline'");
    expect(styles.some((source) => source.startsWith("'nonce-"))).toBe(false);
  });
});

describe("createNonce", () => {
  it("is unique per call and safe inside a CSP source expression", () => {
    const nonces = new Set(Array.from({ length: 100 }, createNonce));
    expect(nonces.size).toBe(100);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});

describe("contentSecurityPolicyHeaderName", () => {
  it("enforces unless the report-only rollback is switched on", () => {
    expect(contentSecurityPolicyHeaderName(undefined)).toBe("Content-Security-Policy");
    expect(contentSecurityPolicyHeaderName("")).toBe("Content-Security-Policy");
    expect(contentSecurityPolicyHeaderName("false")).toBe("Content-Security-Policy");
    expect(contentSecurityPolicyHeaderName("true")).toBe("Content-Security-Policy-Report-Only");
  });
});

describe("proxy", () => {
  it("sends a fresh nonce policy on every page response and forwards it to rendering", () => {
    const policies = [0, 1].map(() => proxy(new NextRequest("https://investi.test/learn")).headers.get("Content-Security-Policy"));
    expect(policies[0]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(policies[0]).toContain("frame-ancestors 'none'");
    expect(policies[0]).not.toBe(policies[1]);

    const response = proxy(new NextRequest("https://investi.test/"));
    const nonce = response.headers.get("Content-Security-Policy")?.match(/'nonce-([^']+)'/)?.[1];
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(response.headers.get("Content-Security-Policy"));
  });
});

describe("next.config headers", () => {
  it("attaches clickjacking, sniffing, referrer and permissions headers to every route", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((rule) => rule.source === "/:path*");
    const byKey = new Map(all?.headers.map(({ key, value }) => [key, value]));
    expect(byKey.get("X-Frame-Options")).toBe("DENY");
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byKey.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    for (const feature of ["camera", "microphone", "geolocation", "payment"]) expect(byKey.get("Permissions-Policy")).toContain(`${feature}=()`);
    expect(all?.headers).toEqual(staticSecurityHeaders);
  });

  it("locks API responses down to nothing loadable and unframeable", async () => {
    const api = (await nextConfig.headers!()).find((rule) => rule.source === "/api/:path*");
    expect(api?.headers).toEqual([{ key: "Content-Security-Policy", value: apiContentSecurityPolicy }]);
    expect(apiContentSecurityPolicy).toContain("default-src 'none'");
    expect(apiContentSecurityPolicy).toContain("frame-ancestors 'none'");
  });
});
