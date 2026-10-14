import "server-only";

import { cache } from "react";
import { perfCount } from "@/lib/perf";

/**
 * Memoizes a read for one React Server Component render (React.cache): the layout and page of one
 * request share a single call per argument list; nothing outlives the request or crosses users.
 * Outside a render (Server Actions, route handlers, scripts) React.cache has no request scope and
 * every call reads afresh, so mutations keep their own uncached reads.
 *
 * Reads only. A render must not mutate what it has already read through one of these.
 * With INVESTI_PERF_DEBUG=1, counters `memo.call.<name>` and `memo.miss.<name>` show reuse per segment.
 */
export function requestMemo<Args extends string[], Result>(name: string, read: (...args: Args) => PromiseLike<Result>) {
  // `async` adopts the result into one native promise. A Drizzle query is a lazy thenable that runs
  // again on every `then`, so caching it directly would repeat the SQL for each awaiting caller.
  const memoized = cache(async (...args: Args) => {
    perfCount(`memo.miss.${name}`);
    return read(...args);
  });
  return (...args: Args): Promise<Result> => {
    perfCount(`memo.call.${name}`);
    return memoized(...args);
  };
}
