import type { InstrumentId } from "@/features/market-data/contracts";
import type { ChartRange } from "./history";

/** Resolve either a raw encoded segment or a segment decoded once by Next. */
export function resolveInstrumentRouteParam(value: unknown): InstrumentId | null {
  if (typeof value !== "string" || value.length < 1 || value.length > 300) return null;
  let instrumentId = value;
  if (value.includes("%")) {
    try {
      const decoded = decodeURIComponent(value);
      if (encodeURIComponent(decoded) === value) instrumentId = decoded;
    } catch { return null; }
  }
  if (instrumentId.length > 100 || instrumentId === "." || instrumentId === ".." || /[\/\\\u0000-\u001f\u007f?#]/.test(instrumentId)) return null;
  if (instrumentId.startsWith("FMP:")) {
    const parts = instrumentId.split(":");
    if (parts.length !== 3 || !parts[1] || !parts[2]) return null;
    try {
      if (!decodeURIComponent(parts[1]) || !decodeURIComponent(parts[2])) return null;
    } catch { return null; }
  } else if (/%(?![\da-fA-F]{2})/.test(instrumentId)) return null;
  return instrumentId;
}

export function instrumentDetailHref(instrumentId: InstrumentId): string {
  if (resolveInstrumentRouteParam(instrumentId) === null) throw new Error("Invalid instrument identity");
  return `/lab/instruments/${encodeURIComponent(instrumentId)}`;
}

/** Query values are already decoded once; reject any value the route decoder would change, never rewrite it. */
export function resolveInstrumentQueryParam(value: unknown): InstrumentId | null {
  const instrumentId = resolveInstrumentRouteParam(value);
  return instrumentId !== null && instrumentId === value ? instrumentId : null;
}

/** `/lab/compare?a=…&b=…&range=…`; a missing instrument opens the picker for it. */
export function instrumentCompareHref(first: InstrumentId | null, second: InstrumentId | null = null, range?: ChartRange): string {
  const query = new URLSearchParams();
  for (const [key, instrumentId] of [["a", first], ["b", second]] as const) {
    if (instrumentId === null) continue;
    if (resolveInstrumentQueryParam(instrumentId) === null) throw new Error("Invalid instrument identity");
    query.set(key, instrumentId);
  }
  if (range) query.set("range", range);
  const search = query.toString();
  return search ? `/lab/compare?${search}` : "/lab/compare";
}
