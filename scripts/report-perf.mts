// P50/P95/max per route segment, cold vs. warm instance, from `[investi:perf]` lines (#405).
// Usage: npm run perf:report -- <log export...> (plain text, JSON Lines or a JSON array; stdin without
// files). Prints a Markdown table, or JSON with --json. Keep exports out of the repository.
import { readFileSync } from "node:fs";
import { extractPerfLines, formatPerfTable, summarizePerf } from "../src/lib/perf-report";

const files = process.argv.slice(2).filter((argument) => argument !== "--json");
const texts = files.length ? files.map((file) => readFileSync(file, "utf8")) : [readFileSync(0, "utf8")];
const lines = texts.flatMap(extractPerfLines);
if (lines.length === 0) throw new Error("No [investi:perf] lines found.");
const rows = summarizePerf(lines);
console.log(process.argv.includes("--json") ? JSON.stringify(rows, null, 2) : `${formatPerfTable(rows)}\n\n${lines.length} segment lines; percentiles are nearest-rank.`);
