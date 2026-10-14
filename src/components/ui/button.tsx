import { AppLink as Link } from "@/components/shell/app-link";
import type { ComponentProps, ReactNode, Ref } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-button border px-5 py-3 text-body font-bold transition-[transform,background-color,border-color,box-shadow,color] duration-[var(--motion-micro)] ease-[var(--ease-standard)] motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-primary-hover bg-primary text-primary-foreground shadow-elevation-1 hover:bg-primary-hover hover:text-white",
        secondary: "border-border-strong bg-surface text-foreground shadow-elevation-1 hover:border-primary hover:bg-primary-soft",
        success: "border-success-ink bg-success text-data-dark shadow-elevation-1 hover:bg-success/85",
        danger: "border-danger bg-danger text-danger-foreground shadow-elevation-1 hover:bg-danger/90",
        ghost: "border-transparent bg-transparent text-primary-hover shadow-none hover:bg-primary-soft",
      },
      size: {
        default: "min-h-12 px-5",
        compact: "min-h-10 rounded-control px-4 py-2 text-small",
        icon: "size-12 min-h-0 shrink-0 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export type ButtonProps = Omit<ComponentProps<"button">, "ref"> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    buttonRef?: Ref<HTMLButtonElement>;
    ref?: Ref<HTMLButtonElement>;
  };

export function Button({ variant, size, loading = false, disabled, className, children, type = "button", buttonRef, ref, ...props }: ButtonProps) {
  return <button {...props} ref={buttonRef ?? ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cn(buttonVariants({ variant, size }), className)}>
    {loading ? <span aria-hidden="true" className="size-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" /> : null}
    {children}
  </button>;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return <Link {...props} className={cn(buttonVariants({ variant, size }), className)} />;
}

export function IconButton({ "aria-label": ariaLabel, ...props }: Omit<ButtonProps, "size" | "children"> & { "aria-label": string; children: ReactNode }) {
  return <Button {...props} aria-label={ariaLabel} size="icon" />;
}
