import type { Instrumentation } from "next";

/**
 * One normalized line per server error Next.js captures: renders, route handlers, uncaught action errors
 * and the proxy. Server actions that catch their own errors log those themselves (`logUnexpectedError`).
 * The request path, query and headers are left out: they can carry reset tokens, cookies or e-mail addresses.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { describeError } = await import("@/lib/server-errors");
  console.error(`[request-error] ${context.routeType} ${context.routePath} failed`, { method: request.method, error: describeError(error) });
};
