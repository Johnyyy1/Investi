"use client";

import { InstrumentSearch } from "@/components/lab/portfolio/instrument-search";
import type { ChartRange } from "@/features/instruments/history";
import { instrumentCompareHref } from "@/features/instruments/routes";

/** Picks the first instrument, or the one to compare `first` with; the comparison opens on selection. */
export function ComparePicker({ id, label, first, range, sample }: { id: string; label: string; first: string | null; range: ChartRange; sample: boolean }) {
  return <InstrumentSearch id={id} label={label} sample={sample} target={{
    href: (instrumentId) => first === null ? instrumentCompareHref(instrumentId, null, range) : instrumentCompareHref(first, instrumentId, range),
    hint: first === null ? "Zadej aspoň dva znaky. Pak vybereš druhý instrument." : "Zadej aspoň dva znaky. Výběrem otevřeš srovnání.",
    opening: "Otevírám srovnání…",
  }} />;
}
