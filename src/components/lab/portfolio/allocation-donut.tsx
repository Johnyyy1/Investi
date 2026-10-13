"use client";

import { useState } from "react";
import styles from "./portfolio-lab.module.css";

export interface DonutSegment {
  id: string;
  label: string;
  color: string;
  /** Share of the whole in basis points; the legend shows `value`, never a recomputed number. */
  basisPoints: number;
  value: string;
  detail?: string;
}

const RADIUS = 50;
const STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** 2 px surface gap between touching segments, measured on the ring. */
const GAP = 2;

/** Donut with a legend that names every value, so identity never rests on colour alone. */
export function AllocationDonut({ segments, center, label }: { segments: readonly DonutSegment[]; center: string; label: string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.basisPoints), 0);
  const visible = segments.filter((segment) => segment.basisPoints > 0);
  const lengths = visible.map((segment) => total > 0 ? (segment.basisPoints / total) * CIRCUMFERENCE : 0);
  const arcs = visible.map((segment, index) => {
    const length = lengths[index];
    const start = lengths.slice(0, index).reduce((sum, value) => sum + value, 0);
    const gap = visible.length > 1 ? Math.min(GAP, length / 2) : 0;
    return { segment, dash: `${Math.max(0, length - gap)} ${CIRCUMFERENCE}`, offset: -start };
  });
  return <div className={styles.allocationBody}>
    <div className={styles.donut}>
      <svg viewBox="0 0 120 120" role="img" aria-label={label}>
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--color-track)" strokeWidth={STROKE} />
        <g transform="rotate(-90 60 60)">
          {arcs.map(({ segment, dash, offset: dashOffset }) => <circle
            key={segment.id}
            cx="60" cy="60" r={RADIUS} fill="none"
            stroke={segment.color} strokeWidth={STROKE} strokeDasharray={dash} strokeDashoffset={dashOffset}
            opacity={active && active !== segment.id ? 0.35 : 1}
            onPointerEnter={() => setActive(segment.id)} onPointerLeave={() => setActive(null)}
          ><title>{`${segment.label}: ${segment.value}${segment.detail ? `, ${segment.detail}` : ""}`}</title></circle>)}
        </g>
      </svg>
      <p className={styles.donutCenter} aria-hidden="true">{center}</p>
    </div>
    <ul className={styles.legend}>
      {segments.map((segment) => <li key={segment.id} className={styles.legendRow} data-active={active === segment.id} onPointerEnter={() => setActive(segment.id)} onPointerLeave={() => setActive(null)}>
        <span className={styles.dot} style={{ background: segment.color }} aria-hidden="true" />
        <span>{segment.label}</span>
        <strong className={styles.num}>{segment.value}</strong>
        {segment.detail ? <small className={styles.num}>{segment.detail}</small> : null}
      </li>)}
    </ul>
  </div>;
}
