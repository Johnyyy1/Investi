import { notFound } from "next/navigation";
import { StepSpecimenGallery } from "@/components/lesson/step-kinds/specimen-gallery";

export const metadata = { title: "Typy kroků lekce · Development", robots: { index: false, follow: false } };
export default function LessonStepsPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <StepSpecimenGallery />;
}
