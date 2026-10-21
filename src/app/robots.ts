import type { MetadataRoute } from "next";
import { isIndexableDeployment, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexableDeployment()) return { rules: { userAgent: "*", disallow: "/" } };
  // Signed-in areas redirect anonymous crawlers to /sign-in and carry noindex themselves.
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dev/"] }, sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
