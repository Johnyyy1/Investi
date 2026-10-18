"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import type { InstrumentSearchResult } from "@/features/market-data/contracts";
import { instrumentDetailHref } from "@/features/instruments/routes";
import { searchPortfolioInstrumentsAction } from "@/features/portfolio/actions";
import styles from "./instrument-search.module.css";
import lab from "./portfolio-lab.module.css";

type SearchState = "idle" | "loading" | "results" | "empty" | "error";

const typeLabel = (assetType: string | null) => assetType === "equity" ? "Akcie" : assetType === "etf" ? "ETF" : assetType === "bond" ? "Dluhopis" : "Typ se ověřuje";

/** Where a chosen result leads, and how the field says so. */
export type InstrumentSearchTarget = { href: (instrumentId: string) => string; hint: string; opening: string };

const detailTarget: InstrumentSearchTarget = {
  href: instrumentDetailHref,
  hint: "Zadej aspoň dva znaky. Výběrem otevřeš detail s grafem, kde můžeš nakoupit.",
  opening: "Otevírám detail…",
};

/** Search → instrument detail by default. Buying happens on the detail page, one order at a time. */
export function InstrumentSearch({ id = "instrument-search", label = "Koupit akcii, ETF nebo dluhopis", sample, target = detailTarget }: { id?: string; label?: string; sample: boolean; target?: InstrumentSearchTarget }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly InstrumentSearchResult[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [opening, startOpen] = useTransition();
  const [, startSearch] = useTransition();
  const request = useRef(0);
  const listId = `${id}-results`;

  useEffect(() => {
    const normalized = query.trim();
    const current = ++request.current;
    if (normalized.length < 2) return;
    const timeout = window.setTimeout(() => startSearch(async () => {
      const response = await searchPortfolioInstrumentsAction(normalized);
      if (current !== request.current) return;
      setResults(response.results);
      setActiveIndex(response.results.length ? 0 : -1);
      if (!response.ok) { setState("error"); setError(response.message); }
      else setState(response.results.length ? "results" : "empty");
    }), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  function clear() {
    request.current += 1;
    setQuery(""); setResults([]); setState("idle"); setActiveIndex(-1); setError(null);
  }

  function open(result: InstrumentSearchResult) {
    startOpen(() => router.push(target.href(result.instrumentId)));
  }

  return <section className={styles.search} aria-labelledby={`${id}-label`}>
    <label id={`${id}-label`} htmlFor={id} className={styles.label}>{label}</label>
    <div className={styles.field}>
      <Search size={20} aria-hidden="true" />
      <input
        id={id} role="combobox" aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 && results[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
        autoComplete="off" placeholder="Název nebo ticker, např. Apple" value={query}
        onChange={(event) => { const value = event.target.value; request.current += 1; setQuery(value); setResults([]); setActiveIndex(-1); setError(null); setState(value.trim().length >= 2 ? "loading" : "idle"); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); if (results.length) { setResults([]); setActiveIndex(-1); setState("idle"); } else clear(); return; }
          if (!results.length) return;
          if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((activeIndex + 1) % results.length); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((activeIndex - 1 + results.length) % results.length); }
          if (event.key === "Enter" && activeIndex >= 0) { event.preventDefault(); open(results[activeIndex]); }
        }}
      />
      {query ? <button type="button" className={styles.clear} aria-label="Vymazat hledání" onClick={clear}><X size={20} aria-hidden="true" /></button> : null}
    </div>
    {results.length > 0 ? <div className={styles.results}>
      <p className={lab.meta}>{results.length} {results.length === 1 ? "výsledek" : results.length < 5 ? "výsledky" : "výsledků"} · {sample ? "ukázková data" : "tržní data"}</p>
      <ul id={listId} role="listbox" aria-label="Výsledky hledání">{results.map((result, index) => <li
        key={result.instrumentId} id={`${id}-option-${index}`} role="option" aria-selected={index === activeIndex} className={styles.result}
        onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => open(result)}>
        <span className={lab.chip}>{result.symbol}</span>
        <span className={styles.resultText}><strong>{result.name}</strong><span>{typeLabel(result.assetType)} · {result.quoteCurrency}{result.exchangeMic ?? result.exchangeCode ? ` · ${result.exchangeMic ?? result.exchangeCode}` : ""}</span></span>
        <ChevronRight size={18} aria-hidden="true" className={styles.chevron} />
      </li>)}</ul>
    </div> : state === "loading" ? <p role="status" className={styles.note}>Hledám…</p>
      : state === "empty" ? <p role="status" className={styles.note}>Nic jsme nenašli. Zkus jiný název nebo ticker.</p>
        : state === "error" ? <p role="alert" className={`${styles.note} ${lab.error}`}>{error}</p>
          : <p className={styles.note}>{target.hint}</p>}
    {opening ? <p role="status" className={styles.note}>{target.opening}</p> : null}
  </section>;
}
