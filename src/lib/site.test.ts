import { afterEach, describe, expect, it, vi } from "vitest";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { BRAND_NAME, canonicalHostRedirects, isIndexableDeployment, SITE_HOST, SITE_URL } from "./site";

afterEach(() => vi.unstubAllEnvs());

describe("brand and canonical origin", () => {
  it("serves Investník from the apex domain", () => {
    expect(BRAND_NAME).toBe("Investník");
    expect(SITE_URL).toBe("https://investnik.cz");
    expect(SITE_HOST).toBe("investnik.cz");
  });

  it("redirects only www.investnik.cz, permanently, to the same path on the apex", () => {
    expect(canonicalHostRedirects).toHaveLength(1);
    const [rule] = canonicalHostRedirects;
    expect(rule).toMatchObject({ source: "/:path*", destination: "https://investnik.cz/:path*", permanent: true });
    // Next.js anchors host values as a full regex match.
    const host = new RegExp(`^${rule.has[0].value}$`);
    expect(host.test("www.investnik.cz")).toBe(true);
    for (const other of ["investnik.cz", "localhost", "localhost:3000", "tryinvesti.vercel.app", "investi-git-feature-johnyyy1.vercel.app", "wwwxinvestnikxcz", "www.investnik.cz.evil.test"]) expect(host.test(other), other).toBe(false);
    // The path parameter covers the root and nested paths; the query is passed through by Next.js.
    const source = getPathMatch(rule.source);
    for (const path of ["/", "/learn", "/learn/zaklady/lekce-1", "/api/auth/callback/google"]) expect(source(path), path).not.toBe(false);
  });

  it("lets search engines index production only", () => {
    expect(isIndexableDeployment("production")).toBe(true);
    expect(isIndexableDeployment(undefined)).toBe(true);
    expect(isIndexableDeployment("preview")).toBe(false);
    expect(isIndexableDeployment("development")).toBe(false);
  });
});

describe("metadata routes", () => {
  it("publishes robots rules and the sitemap on production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dev/"] }, sitemap: "https://investnik.cz/sitemap.xml", host: "https://investnik.cz" });
  });

  it("leaves noindex routes crawlable so search engines can read their noindex", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const disallowed = [robots().rules].flat().flatMap(({ disallow }) => [disallow ?? []].flat());
    const noindexRoutes = ["/onboarding", "/onboarding/plan", "/learn", "/lab", "/progress", "/settings", "/dashboard", "/forgot-password", "/reset-password", "/verify-email"];
    for (const path of noindexRoutes) expect(disallowed.some((prefix) => path.startsWith(prefix)), path).toBe(false);
  });

  it("keeps preview deployments out of search", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("lists only public pages on the canonical origin", () => {
    expect(sitemap().map(({ url }) => url)).toEqual(["https://investnik.cz", "https://investnik.cz/privacy", "https://investnik.cz/terms"]);
  });

  it("installs as Investník with the brand icons", () => {
    const app = manifest();
    expect(app).toMatchObject({ name: "Investník", short_name: "Investník", lang: "cs-CZ", start_url: "/learn", display: "standalone" });
    expect(app.icons?.map(({ src, purpose }) => `${src} ${purpose}`)).toEqual(["/brand/icon-192.png any", "/brand/icon-512.png any", "/brand/icon-maskable-512.png maskable"]);
  });
});
