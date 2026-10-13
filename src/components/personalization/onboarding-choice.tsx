import type { ReactNode } from "react";
import { Check } from "lucide-react";
import styles from "./personalization-flow.module.css";

/** Native controls keep radio arrows and checkbox keyboard behavior intact. */
export function OnboardingChoice({ name, value, checked, disabled, type = "radio", onChange, children }: {
  name: string; value: string; checked: boolean; disabled?: boolean; type?: "radio" | "checkbox";
  onChange: (value: string) => void; children: ReactNode;
}) {
  return <label className={styles.choice} data-selected={checked} data-disabled={Boolean(disabled)}>
    <span>{children}</span>
    <input type={type} name={name} value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} />
    <span className={styles.choiceMark} aria-hidden="true">{checked && <Check size={12} strokeWidth={2.5} />}</span>
  </label>;
}
