import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron calls the job's path with `Authorization: Bearer <CRON_SECRET>` when the project defines
 * CRON_SECRET. Without a configured secret every request is refused, so the job cannot run unprotected.
 * Both sides are hashed first so the comparison is constant-time regardless of length.
 */
export function isAuthorizedCronRequest(authorization: string | null, secret: string | undefined) {
  if (!secret || !authorization) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
