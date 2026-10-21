import type { MetadataRoute } from "next";
import { BRAND_NAME, SITE_DESCRIPTION } from "@/lib/site";

/** Install metadata only: there is no service worker, so nothing is cached offline. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: SITE_DESCRIPTION,
    lang: "cs-CZ",
    start_url: "/learn",
    scope: "/",
    display: "standalone",
    background_color: "#f7f2e8",
    theme_color: "#f7f2e8",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
