import { Inter, Manrope } from "next/font/google";

// The product's two families: Manrope for headings, Inter for UI and reading text.
// The tokens in tokens.css resolve these variables, so they belong on <html>.
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-investi-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "latin-ext"], variable: "--font-investi-manrope", display: "swap" });

export const fontVariables = `${inter.variable} ${manrope.variable}`;
