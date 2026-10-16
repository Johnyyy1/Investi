import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const controlClassName = "min-h-12 w-full min-w-0 rounded-control border border-border-strong bg-surface px-4 text-body text-foreground shadow-elevation-0 transition-[background-color,border-color,box-shadow] duration-[var(--motion-micro)] ease-[var(--ease-standard)] placeholder:text-secondary hover:border-border-strong focus-visible:border-primary-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-secondary aria-invalid:border-danger-ink";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn(controlClassName, className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(controlClassName, "min-h-28 resize-y py-3", className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cn(controlClassName, "cursor-pointer pr-10 disabled:cursor-not-allowed", className)} />;
}

export function Slider({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return <input {...props} type="range" className={cn("investi-range min-h-12 w-full cursor-pointer accent-primary disabled:cursor-not-allowed", className)} />;
}
