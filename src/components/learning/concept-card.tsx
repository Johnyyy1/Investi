import type { ReactNode } from "react";
import { surfaceVariants } from "@/components/ui/surface";

export function ConceptCard({ title, children }: { title: string; children: ReactNode }) {
  return <aside className={`${surfaceVariants({ tone: "muted" })} p-6`}>
    <h3 className="text-card-title font-semibold">{title}</h3>
    <div className="mt-2 text-body text-secondary">{children}</div>
  </aside>;
}
