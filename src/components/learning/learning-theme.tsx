import type { ReactNode } from "react";
import { Inter, Manrope, Nunito_Sans } from "next/font/google";
import "katex/dist/katex.min.css";

const font = Nunito_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-learning" });
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-investi-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "latin-ext"], variable: "--font-investi-manrope", display: "swap" });

/** Shared, server-rendered theme for the entire product. */
export function LearningTheme({ children }: { children: ReactNode }) {
  return <div className={`${font.variable} ${inter.variable} ${manrope.variable} learning-theme min-h-screen`}>{children}</div>;
}
