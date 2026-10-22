import type { FactValue, FactVersion } from "./types";

const DAY = 86_400_000;
export const STALE_WARNING_DAYS = 60;

export function factToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function calendarDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid fact calendar date: ${value}`);
  }
  return value;
}

export function resolveFact(key: string, asOf: string, registry: readonly FactVersion[]): FactVersion {
  calendarDate(asOf);
  const versions = registry.filter((fact) => fact.key === key);
  if (!versions.length) throw new Error(`Unknown fact token: ${key}`);
  const applicable = versions.filter((fact) => fact.validFrom <= asOf && (!fact.validTo || asOf <= fact.validTo));
  if (applicable.length !== 1) throw new Error(`Expected one applicable version of ${key} at ${asOf}; found ${applicable.length}`);
  return applicable[0];
}

/** Numbers are percentage points when unit is %, never monetary accounting inputs. */
export function formatFactValue(value: FactValue): string {
  const amount = typeof value.amount === "number"
    ? new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 10 }).format(value.amount)
    : value.amount;
  return value.unit ? `${amount} ${value.unit}` : amount;
}

export function factReviewState(fact: FactVersion, today: string) {
  calendarDate(today);
  const overdueDays = Math.max(0, Math.floor((Date.parse(today) - Date.parse(fact.nextReviewAt)) / DAY));
  return { overdueDays, overdue: overdueDays > 0, stale: overdueDays >= STALE_WARNING_DAYS };
}

export function formatFactDate(date: string) {
  return new Intl.DateTimeFormat("cs-CZ", { timeZone: "UTC", day: "numeric", month: "numeric", year: "numeric" }).format(new Date(calendarDate(date)));
}

export function validateFactRegistry(registry: readonly FactVersion[]): void {
  const identities = new Set<string>();
  for (const fact of registry) {
    if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(fact.key)) throw new Error(`Invalid fact key: ${fact.key}`);
    const identity = `${fact.key}@${fact.version}`;
    if (!fact.version || identities.has(identity)) throw new Error(`Duplicate or missing fact version: ${identity}`);
    identities.add(identity);
    for (const field of [fact.label, fact.jurisdiction, fact.legalBasis, fact.period, fact.owner, fact.notes]) {
      if (!field.trim()) throw new Error(`Missing metadata: ${identity}`);
    }
    for (const date of [fact.validFrom, fact.checkedAt, fact.nextReviewAt, ...(fact.validTo ? [fact.validTo] : []), ...(fact.verifiedAt ? [fact.verifiedAt] : [])]) calendarDate(date);
    if (fact.validTo && fact.validTo < fact.validFrom) throw new Error(`Reversed validity: ${identity}`);
    if (fact.nextReviewAt < fact.checkedAt || (fact.verifiedAt && fact.verifiedAt > fact.checkedAt)) throw new Error(`Invalid review dates: ${identity}`);
    if ((fact.verificationStatus === "unverified") !== (fact.verifiedAt === null)) throw new Error(`Verification date/status mismatch: ${identity}`);
    if (typeof fact.value.amount === "number" ? !Number.isFinite(fact.value.amount) : !fact.value.amount.trim()) throw new Error(`Invalid fact value: ${identity}`);
    if (!fact.sources.length || fact.sources.some((source) => !source.title.trim() || !/^https:\/\//.test(source.url) || !URL.canParse(source.url))) throw new Error(`Missing HTTPS source: ${identity}`);
    if ((fact.key.startsWith("spiva.") || fact.key.startsWith("morningstar.")) && (!fact.research?.sample || !fact.research.period || !fact.research.limitations)) throw new Error(`Missing research limitations: ${identity}`);
    for (const other of registry) {
      if (other === fact || other.key !== fact.key) continue;
      if (fact.validFrom <= (other.validTo ?? "9999-12-31") && other.validFrom <= (fact.validTo ?? "9999-12-31")) throw new Error(`Overlapping fact versions: ${fact.key}`);
    }
  }
}
