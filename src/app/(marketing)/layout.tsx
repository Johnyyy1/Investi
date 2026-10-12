import type { ReactNode } from "react";
import { Manrope, Inter } from "next/font/google";

const display = Manrope({ subsets: ["latin", "latin-ext"], weight: ["600", "800"], variable: "--pen-display", display: "swap" });
const body = Inter({ subsets: ["latin", "latin-ext"], variable: "--pen-body", display: "swap" });

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className={`${display.variable} ${body.variable}`}>{children}</div>;
}
