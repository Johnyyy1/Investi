import { RouteState } from "@/components/route-state/route-state";

/** Unknown or planned modules and lessons. */
export default function LessonNotFound() {
  return <RouteState pose="18-bookshelf" eyebrow="Učení" title="Tahle lekce zatím není k dispozici" action={{ href: "/learn", label: "Zpět na Učení" }}>
    Může být teprve v plánu, nebo se změnila adresa. Pokračuj některou z dostupných lekcí v Učení.
  </RouteState>;
}
