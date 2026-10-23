"use client";
import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { controlClassName } from "@/components/ui/form-controls";

export type FinanceInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "prefix"> & {
  label: string; mode?: "number" | "currency" | "percentage"; value: string;
  onValueChange: (value: string) => void; prefix?: string; suffix?: string; error?: string; hint?: string;
};
/** Raw strings cross the boundary unchanged. Domain code owns parsing and validation. */
export function FinanceInput({ label, mode = "number", value, onValueChange, prefix, suffix, error, hint, id, className, ...props }: FinanceInputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const descriptionId = `${inputId}-description`;
  return <div className={cn("min-w-0", className)}>
    <label htmlFor={inputId} className="mb-2 block text-small font-bold">{label}</label>
    <div className={cn(controlClassName, "flex items-center gap-2 focus-within:border-primary-hover focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-primary-hover", error && "border-danger-ink")}>
      {prefix ? <span className="shrink-0 whitespace-nowrap text-small text-secondary">{prefix}</span> : null}
      <input {...props} id={inputId} type="text" inputMode="decimal" value={value} onChange={(event) => onValueChange(event.target.value)} aria-invalid={props["aria-invalid"] ?? Boolean(error)} aria-describedby={[props["aria-describedby"], error || hint ? descriptionId : undefined].filter(Boolean).join(" ") || undefined} className="min-h-12 w-full min-w-0 bg-transparent text-body tabular-nums focus-visible:outline-none disabled:text-secondary" />
      {suffix || mode === "percentage" ? <span className="shrink-0 whitespace-nowrap text-small text-secondary">{suffix ?? "%"}</span> : null}
    </div>
    {error || hint ? <p id={descriptionId} className={cn("mt-2 text-small", error ? "text-danger-ink" : "text-secondary")}>{error ?? hint}</p> : null}
  </div>;
}
