import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { fontVariables } from "@/styles/fonts";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "investi", template: "%s · investi" },
  description: "Nauč se investovat praxí.",
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
