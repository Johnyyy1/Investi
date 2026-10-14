import type { CSSProperties, ElementType, ReactNode } from "react";

/** Marks content for the shared scroll reveal (see utils.useReveal). Renders plain markup; no motion code ships here. */
export function Reveal({ as: Tag = "div", fade = false, delay, stagger = false, className, style, children }: {
  as?: ElementType; fade?: boolean; delay?: number; stagger?: boolean; className?: string; style?: CSSProperties; children: ReactNode;
}) {
  return <Tag className={className} style={style} data-reveal={fade ? "fade" : "up"} data-reveal-delay={delay} data-reveal-stagger={stagger ? "" : undefined}>{children}</Tag>;
}

/** Heading whose words (or characters / lines) animate in when it scrolls into view. SplitText keeps it accessible. */
export function SplitHeading({ as: Tag = "h2", mode = "words", ...props }: {
  as?: ElementType; mode?: "words" | "chars" | "lines"; id?: string; className?: string; children: ReactNode;
}) {
  return <Tag {...props} data-split={mode} />;
}

/** Number that counts up when its section enters the viewport. Renders the final value for SSR / no-JS. */
export function CountUp({ to, className }: { to: number; className?: string }) {
  return <span className={className} data-count-to={to}>{to.toLocaleString("cs-CZ")}</span>;
}

/** Spread onto a button or link to give it the magnetic hover (desktop, fine pointers). */
export const magneticProps = { "data-magnetic": "" } as const;
