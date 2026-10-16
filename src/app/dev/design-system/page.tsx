import { notFound } from "next/navigation";
import { DesignSystemShowcase } from "@/components/design-system/showcase";

export const metadata = { title: "Design system · Development", robots: { index: false, follow: false } };
export default function DesignSystemPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DesignSystemShowcase />;
}
