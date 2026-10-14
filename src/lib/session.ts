import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { perfMeasure } from "@/lib/perf";

export async function getCurrentUser() {
  const session = await perfMeasure("auth.getSession", "auth", async () => auth.api.getSession({ headers: await headers() }));
  return session?.user ?? null;
}
