import type { Metadata } from "next";
import { LandingViewBeacon } from "@/components/marketing/landing-view-beacon";
import { PenLanding } from "@/components/marketing/pen-landing";
import { BRAND_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

const title = `${BRAND_NAME} – nauč se investovat od základů po vlastní plán`;

export const metadata: Metadata = {
  title: { absolute: title },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

/** Describes the product, not a company: the operator's identity is still a placeholder (components/legal). */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: BRAND_NAME, url: SITE_URL, logo: `${SITE_URL}/brand/icon-512.png` },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: BRAND_NAME, url: SITE_URL, inLanguage: "cs-CZ", description: SITE_DESCRIPTION, publisher: { "@id": `${SITE_URL}/#organization` } },
  ],
};

export default function MarketingPage() {
  return <>
    {/* A data block, not a script: CSP does not apply and `<` is escaped against markup injection. */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <PenLanding />
    <LandingViewBeacon />
  </>;
}
