export type FigureDataSource =
  | { kind: "model" }
  | { kind: "historical"; source: string; asOf: string }
  | { kind: "sample" }
  | { kind: "simulation"; seed: string | number };

/** A source is explicit: a synthetic series must never be presented as market history. */
export function FigureDataLabel({ data }: { data: FigureDataSource }) {
  const label = data.kind === "model" ? "Modelový příklad"
    : data.kind === "historical" ? `Historická data · ${data.source} · stav k ${data.asOf}`
    : data.kind === "simulation" ? `Simulace · seed ${data.seed}`
    : "Ukázková data · pevná data pro výuku, ne skutečný vývoj trhu";
  return <p className="min-w-0 break-words text-small font-semibold text-secondary">{label}</p>;
}
