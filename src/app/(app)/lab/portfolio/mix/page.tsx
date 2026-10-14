import { redirect } from "next/navigation";

/** The weight builder was retired: instruments are bought one order at a time from their detail page. */
export default function PortfolioMixPage() {
  redirect("/lab/portfolio");
}
