"use client";

import { Slider } from "@/components/ui/form-controls";
import { useId } from "react";
import { parseNumericAnswer } from "@/features/finance/numeric-input";
import { FinanceInput, type FinanceInputProps } from "./finance-input";

type FinanceSliderProps = Pick<FinanceInputProps, "label" | "mode" | "suffix" | "value" | "onValueChange" | "error" | "hint" | "disabled"> & {
  min: number; max: number; step?: number | "any";
};

/** The text field preserves drafts (including blanks/commas); only a slider gesture replaces them.
 * Domain validation belongs to the caller. Range bounds limit the slider, not the typed model input.
 */
export function FinanceSlider({ label, value, onValueChange, min, max, step = "any", error, hint, disabled, ...props }: FinanceSliderProps) {
  const id = useId();
  const parsed = parseNumericAnswer(value);
  const rangeValue = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min;
  return <div className="min-w-0 space-y-2">
    <FinanceInput {...props} id={id} label={label} value={value} onValueChange={onValueChange} error={error} hint={hint} disabled={disabled} />
    <label htmlFor={`${id}-range`} className="sr-only">{label} · posuvník</label>
    <Slider id={`${id}-range`} min={min} max={max} step={step} value={rangeValue} disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
      aria-describedby={error || hint ? `${id}-description` : undefined}
      className="block min-h-12 w-full min-w-0 cursor-pointer accent-primary focus-visible:rounded-control focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary disabled:cursor-not-allowed" />
  </div>;
}
