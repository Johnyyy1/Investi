import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { fontVariables } from "@/styles/fonts";
import { BRAND_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: BRAND_NAME,
  title: { default: BRAND_NAME, template: `%s · ${BRAND_NAME}` },
  description: "Nauč se investovat praxí.",
  // Pages leave openGraph alone: their own object would replace this one and drop the file-based
  // opengraph-image. og:title and og:description already follow each page's title and description.
  openGraph: { type: "website", siteName: BRAND_NAME, locale: "cs_CZ" },
  twitter: { card: "summary_large_image" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f2e8" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The CSP nonce is per request, so no page may be prerendered with nonce-less scripts.
  await connection();
  return <html lang="cs" className={fontVariables}><body><div className="investi-theme min-h-screen">{children}</div></body></html>;
}
