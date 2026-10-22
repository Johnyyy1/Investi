import { notFound } from "next/navigation";
import { GuidedBlock } from "@/components/lesson/guided-block";

export const metadata = { title: "Výukové kalkulačky · Development", robots: { index: false, follow: false } };
export default function LessonCalculatorsPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 [overflow-wrap:anywhere]">
    <h1 className="text-section-title font-semibold">Výukové kalkulačky</h1>
    <GuidedBlock block={{ id: "calculator-specimen", type: "interactiveFigure", figure: "recovery-explorer", title: "Návrat po ztrátě", description: "Změň hodnotu textem nebo posuvníkem. Výpočet slouží k výuce, ne jako prognóza." }} />
  </main>;
}
