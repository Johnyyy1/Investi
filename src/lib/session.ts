import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { perfMeasure } from "@/lib/perf";
import { requestMemo } from "@/lib/request-memo";

// Keyed by nothing but the request: the cookies come from this request's headers.
const readSession = requestMemo("session", async () => auth.api.getSession({ headers: await headers() }));

export async function getCurrentUser() {
  const session = await perfMeasure("auth.getSession", "auth", readSession);
  return session?.user ?? null;
}

/** The session row itself, for screens that depend on when the learner signed in. */
export async function getCurrentSession() {
  const session = await perfMeasure("auth.getSession", "auth", readSession);
  return session?.session ?? null;
}
