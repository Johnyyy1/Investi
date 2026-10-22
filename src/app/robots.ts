import type { MetadataRoute } from "next";
import { isIndexableDeployment, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexableDeployment()) return { rules: { userAgent: "*", disallow: "/" } };
  // Signed-in areas and onboarding carry noindex themselves. Disallowing them here would hide that
  // noindex from crawlers and let linked URLs (the landing CTA → /onboarding) be indexed without content.
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dev/"] }, sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
