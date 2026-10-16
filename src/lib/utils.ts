import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Tell tailwind-merge about the custom scales in styles/tokens.css. Without this it reads
// `text-small` as a colour and drops it next to `text-secondary`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["microcopy", "small", "body", "emphasis", "card-title", "section-title", "page-title", "celebration"],
      radius: ["compact", "control", "button", "surface", "panel", "pill"],
      shadow: ["elevation-0", "elevation-1", "elevation-2"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
