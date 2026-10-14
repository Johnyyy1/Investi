import Link from "next/link";
import type { ComponentProps } from "react";
import { LinkPendingReporter } from "./navigation-status";

/** next/link that reports its pending navigation to the app shell's indicator. Use it for links
 * inside the authenticated app; outside the shell the report is a no-op. */
export function AppLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<LinkPendingReporter /></Link>;
}
