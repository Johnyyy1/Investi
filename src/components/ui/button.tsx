import { AppLink as Link } from "@/components/shell/app-link";
import type { ComponentProps, ReactNode, Ref } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The one button style for the product. Links that look like buttons use ButtonLink, or
 * buttonVariants() on the element. Screen CSS modules add layout only (width, margin),
 * never colour, radius or height: unlayered module rules would override these utilities.
 */
export const buttonVariants = cva(
  "inline-flex max-w-full cursor-pointer items-center justify-center gap-3 rounded-button border text-center font-semibold leading-[1.3] no-underline transition-[background-color,border-color,color] duration-[160ms] ease-out disabled:cursor-not-allowed aria-disabled:cursor-not-allowed [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-transparent bg-primary text-primary-foreground not-disabled:not-aria-disabled:hover:bg-primary-hover not-disabled:not-aria-disabled:active:bg-primary-pressed disabled:bg-track disabled:text-disabled aria-disabled:bg-track aria-disabled:text-disabled",
        secondary: "border-border-strong bg-surface text-foreground not-disabled:hover:bg-surface-muted not-disabled:active:bg-surface-muted disabled:border-border disabled:text-disabled",
        ghost: "border-transparent bg-transparent text-primary not-disabled:hover:bg-primary-soft disabled:text-disabled",
        danger: "border-transparent bg-danger text-danger-foreground not-disabled:hover:bg-danger-strong not-disabled:active:bg-danger-strong-hover disabled:opacity-60",
        dangerQuiet: "border-danger-strong-border bg-transparent text-danger-strong not-disabled:hover:border-danger-strong not-disabled:hover:bg-danger-soft not-disabled:hover:text-danger-strong-hover disabled:opacity-60",
      },
      size: {
        default: "min-h-[52px] px-[22px] py-3 text-body",
        compact: "min-h-12 px-4 py-2 text-small",
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
