import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { LearningTheme } from "@/components/learning/learning-theme";
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
    { media: "(prefers-color-scheme: light)", color: "#F8F6F0" },
    { media: "(prefers-color-scheme: dark)", color: "#102D4C" },
  ],
};
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The CSP nonce is per request, so no page may be prerendered with nonce-less scripts.
  await connection();
  return <html lang="cs"><body><LearningTheme>{children}</LearningTheme></body></html>;
}
