// Client-side navigation benchmark: /learn -> /progress -> /lab -> /learn (core) and the same cycle
// through /lab/portfolio (extended). Measures what the learner perceives and splits it into layers.
//
//   navigation latency  click -> destination heading rendered and loading skeleton gone (in page)
//   feedback latency    click -> URL committed with the loading UI shown and no page heading yet
//   URL change          click -> location.pathname is the destination (with or without a loading UI)
//   pending             click -> the shell's navigation indicator is pending (`data-navigation-pending`, fed by
//                       useLinkStatus); it fades in after a CSS delay, so this is the earliest feedback, not paint
//   RSC end             click -> end of the navigation response stream (Resource Timing)
//   RSC requests        navigation (non-prefetch) and prefetch `_rsc` responses seen during each navigation
//   RSC response        click -> response headers of the non-prefetch `_rsc` request (network + server TTFB).
//                       The streamed body never reports "finished" to Playwright, so no end time is taken.
//   after response      navigation end - RSC response start: body streaming + React commit + paint
//                       (upper bound for client rendering; includes any React-imposed commit delay)
//   server execution    `[investi:perf]` segment lines, only when BENCH_SERVER_LOG is given and the
//                       server was started with INVESTI_PERF_DEBUG=1 (see docs/performance-baseline.md)
//
// Requires a LOCAL app and a DISPOSABLE database: it creates one anonymous demo identity and deletes it.
// Use a production build (`next build && next start`); dev-mode timings are not representative.
import "dotenv/config";
import assert from "node:assert/strict";
import { mkdir, open, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import postgres from "postgres";
import { chromium } from "playwright";

const baseURL = process.env.BENCH_BASE_URL ?? "http://localhost:3000";
const iterations = Number(process.env.BENCH_ITERATIONS ?? 15);
const coldRuns = Number(process.env.BENCH_COLD_RUNS ?? 5);
const serverLog = process.env.BENCH_SERVER_LOG;
const output = process.env.BENCH_OUTPUT ?? "test-results/navigation-benchmark.json";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(local(new URL(baseURL).hostname) && local(new URL(process.env.DATABASE_URL).hostname), "Requires a local app and a disposable local database.");
assert.ok(Number.isInteger(iterations) && iterations >= 1 && Number.isInteger(coldRuns) && coldRuns >= 1, "BENCH_ITERATIONS and BENCH_COLD_RUNS must be positive integers.");

const scenarios = [
  { name: "core", cycle: ["/learn", "/progress", "/lab", "/learn"] },
  { name: "extended", cycle: ["/learn", "/progress", "/lab", "/lab/portfolio", "/learn"] },
];
const hardLoadRoutes = ["/learn", "/progress", "/lab", "/lab/portfolio"];

const median = (values) => { const sorted = [...values].sort((a, b) => a - b); const mid = sorted.length >> 1; return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
const p95 = (values) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * 0.95) - 1)];
const round = (value) => Math.round(value * 10) / 10;
function stats(values) {
  const present = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!present.length) return null;
  return { n: present.length, median: round(median(present)), p95: round(p95(present)), min: round(Math.min(...present)), max: round(Math.max(...present)) };
}
const METRICS = ["navigationMs", "feedbackMs", "urlMs", "pendingMs", "rscEndMs", "rscNavigationRequests", "rscPrefetchRequests", "rscResponseMs", "afterResponseMs", "serverPageMs", "serverLayoutMs", "serverExternalMs", "serverDbQueries"];
function summarize(samples) {
  const byRoute = {};
  for (const sample of samples) (byRoute[sample.to] ??= []).push(sample);
  return Object.fromEntries(Object.entries(byRoute).map(([route, rows]) => [route, Object.fromEntries(METRICS.map((metric) => [metric, stats(rows.map((row) => row[metric]))]))]));
}

async function readLogFrom(offset) {
  if (!serverLog) return [];
  const handle = await open(serverLog, "r");
  try {
    const { size } = await handle.stat();
    const buffer = Buffer.alloc(Math.max(0, size - offset));
    await handle.read(buffer, 0, buffer.length, offset);
    return buffer.toString("utf8").split("\n").filter((line) => line.startsWith("[investi:perf] ")).map((line) => JSON.parse(line.slice("[investi:perf] ".length)));
  } finally { await handle.close(); }
}
const logSize = async () => (serverLog ? (await stat(serverLog)).size : 0);

const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
let userId;
try {
  // Disposable authenticated identity. Its id and cookies stay in memory and are never printed.
  const seed = await browser.newContext();
  const signIn = await seed.request.post(`${baseURL}/api/auth/sign-in/anonymous`, { headers: { origin: baseURL }, data: {} });
  assert.equal(signIn.status(), 200, "Anonymous QA sign-in failed.");
  userId = (await signIn.json()).user?.id;
  assert.ok(userId, "Anonymous sign-in returned no user.");
  const storageState = await seed.storageState();
  await seed.close();

  const freshContext = () => browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Europe/Prague", storageState });

  /** One soft navigation: click the visible link (what a learner does); fall back to the App Router. */
  async function navigate(page, to) {
    const link = page.locator(`a[href="${to}"]:visible`).first();
    const viaLink = (await link.count()) > 0;
    const logOffset = await logSize();
    const rscRequests = [];
    let prefetchRequests = 0;
    const onResponse = async (response) => {
      const request = response.request();
      if (!request.url().includes("_rsc=")) return;
      if ((await request.allHeaders())["next-router-prefetch"]) { prefetchRequests += 1; return; }
      const { startTime, responseStart } = request.timing();
      rscRequests.push({ startTime, responseStart });
    };
    page.on("response", onResponse);
    const handle = viaLink ? await link.elementHandle() : null;
    const result = await page.evaluate(({ to, handle }) => new Promise((resolve) => {
      const t0 = performance.now();
      const startEpoch = performance.timeOrigin + t0;
      let skeleton = null, url = null, pending = null;
      const ready = () => location.pathname === to && !!document.querySelector("h1");
      const check = () => {
        const now = performance.now() - t0;
        if (url === null && location.pathname === to) url = now;
        if (skeleton === null && location.pathname === to && !document.querySelector("h1")) skeleton = now;
        // Shell indicator fed by useLinkStatus. It fades in after a CSS delay on top of this.
        if (pending === null && document.querySelector("[data-navigation-pending]")) pending = now;
        if (!ready()) return;
        observer.disconnect();
        // Two frames after commit so the paint that makes the page visible is included.
        requestAnimationFrame(() => requestAnimationFrame(() => resolve({ total: performance.now() - t0, skeleton, url, pending, startEpoch, endEpoch: performance.timeOrigin + performance.now() })));
      };
      const observer = new MutationObserver(check);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      if (handle) handle.click(); else window.next.router.push(to);
      check();
    }), { to, handle });
    await page.waitForTimeout(250); // let response events and server log lines land
    page.off("response", onResponse);
    // Resource Timing has the end of the streamed navigation response, which Playwright never reports.
    const rscEndMs = await page.evaluate(({ to, startEpoch }) => {
      const entry = performance.getEntriesByType("resource").filter((e) => e.name.includes("_rsc=") && new URL(e.name).pathname === to && performance.timeOrigin + e.startTime >= startEpoch - 1).at(-1);
      performance.clearResourceTimings();
      return entry ? performance.timeOrigin + entry.responseEnd - startEpoch : null;
    }, { to, startEpoch: result.startEpoch });
    const rsc = rscRequests.sort((a, b) => a.startTime - b.startTime).at(-1);
    const segments = await readLogFrom(logOffset);
    const target = segments.find((segment) => segment.segment === `page:${to}`);
    const related = target ? segments.filter((segment) => segment.request === target.request) : [];
    return {
      to,
      method: viaLink ? "link-click" : "router.push",
      navigationMs: result.total,
      feedbackMs: result.skeleton,
      urlMs: result.url,
      pendingMs: result.pending,
      rscEndMs,
      rscNavigationRequests: rscRequests.length,
      rscPrefetchRequests: prefetchRequests,
      rscResponseMs: rsc ? rsc.startTime + rsc.responseStart - result.startEpoch : null,
      afterResponseMs: rsc ? result.endEpoch - (rsc.startTime + rsc.responseStart) : null,
      serverPageMs: target?.totalMs ?? null,
      serverLayoutMs: related.find((segment) => segment.segment.startsWith("layout:"))?.totalMs ?? null,
      serverExternalMs: target?.kindTotalsMs?.external ?? null,
      serverDbQueries: related.length ? related.reduce((sum, segment) => sum + segment.dbQueryCount, 0) : null,
      segments: related,
    };
  }

  const report = { baseURL, iterations, coldRuns, startedAt: new Date().toISOString(), serverLogCorrelation: Boolean(serverLog), scenarios: {}, hardLoads: {} };

  for (const scenario of scenarios) {
    const errors = [];
    /** Runs the cycle `passes` times in one browser context; every visit follows the first load of cycle[0]. */
    async function run(context, passes) {
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${baseURL}${scenario.cycle[0]}`, { waitUntil: "load" });
      await page.locator("h1").first().waitFor();
      const samples = [];
      for (let pass = 0; pass < passes; pass += 1) for (const to of scenario.cycle.slice(1)) samples.push({ ...await navigate(page, to), pass });
      return samples;
    }
    // Cold client: a brand-new context per run (empty router cache, no prefetched shells, JS re-fetched).
    const cold = [];
    for (let index = 0; index < coldRuns; index += 1) {
      const context = await freshContext();
      cold.push(...await run(context, 1));
      await context.close();
    }
    // Warm client: one context, first pass discarded (it is the cold pass), then `iterations` measured passes.
    const warmContext = await freshContext();
    const warm = (await run(warmContext, iterations + 1)).filter((sample) => sample.pass > 0);
    await warmContext.close();
    // Server-side coldness depends on whether the server process was restarted before this run.
    report.scenarios[scenario.name] = { cycle: scenario.cycle, cold: summarize(cold), warm: summarize(warm), pageErrors: errors.length, samples: [...cold.map((s) => ({ ...s, phase: "cold" })), ...warm.map((s) => ({ ...s, phase: "warm" }))].map((sample) => Object.fromEntries(Object.entries(sample).filter(([key]) => key !== "segments"))), serverSegments: [...cold, ...warm].flatMap((sample) => sample.segments) };
  }

  // Full document loads (no client router): how long the first paint of each route takes from a cold tab.
  for (const route of hardLoadRoutes) {
    const timings = [];
    for (let index = 0; index < iterations; index += 1) {
      const context = await freshContext();
      const page = await context.newPage();
      await page.goto(`${baseURL}${route}`, { waitUntil: "load" });
      await page.locator("h1").first().waitFor();
      timings.push(await page.evaluate(() => { const [nav] = performance.getEntriesByType("navigation"); return { ttfbMs: nav.responseStart, domContentLoadedMs: nav.domContentLoadedEventEnd, loadMs: nav.loadEventEnd }; }));
      await context.close();
    }
    report.hardLoads[route] = { ttfbMs: stats(timings.map((t) => t.ttfbMs)), domContentLoadedMs: stats(timings.map((t) => t.domContentLoadedMs)), loadMs: stats(timings.map((t) => t.loadMs)) };
  }

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  for (const [name, scenario] of Object.entries(report.scenarios)) {
    for (const phase of ["cold", "warm"]) {
      console.log(`\n${name} / ${phase} (ms; median | p95)`);
      console.table(Object.fromEntries(Object.entries(scenario[phase]).map(([route, metrics]) => [route, Object.fromEntries(Object.entries(metrics).map(([metric, value]) => [metric, value ? `${value.median} | ${value.p95} (n=${value.n})` : "-"]))])));
    }
  }
  console.log("\nHard loads (ms; median | p95)");
  console.table(Object.fromEntries(Object.entries(report.hardLoads).map(([route, metrics]) => [route, Object.fromEntries(Object.entries(metrics).map(([metric, value]) => [metric, `${value.median} | ${value.p95}`]))])));
  console.log(`\nWrote ${output}`);
} finally {
  if (userId) await sql`delete from "user" where id = ${userId}`;
  await sql.end();
  await browser.close();
}
