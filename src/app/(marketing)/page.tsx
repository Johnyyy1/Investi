import type { Metadata } from "next";
import { PenLanding } from "@/components/marketing/pen-landing";

export const metadata: Metadata = {
  title: "Peníze jsou vážné. Učení nemusí být.",
  description: "Krátké lekce, praktická cvičení a portfolio nanečisto. Objev investování bez skutečných peněz.",
};

export default function MarketingPage() {
  return <PenLanding />;
}
