// Redesign acceptance against an isolated local runtime/database.
import "dotenv/config";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";

const baseURL = process.env.BACKTEST_TEST_URL ?? "http://localhost:3104";
const local = (url) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
assert.ok(local(baseURL) && local(process.env.DATABASE_URL), "Use an isolated local runtime and database.");
const output = process.env.BACKTEST_SCREENSHOT_DIR ?? "/tmp/investi-backtesting-qa";
await mkdir(output, { recursive: true });
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Europe/Prague", reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let userId;
const button = (name) => page.getByRole("button", { name, exact: true });
const final = () => page.getByTestId("metric-konečná-hodnota");
const text = async (testId) => (await page.getByTestId(testId).textContent()).replace(/\s/g, "");
const number = (value) => Number(value.replace(/[^\d,+-]/g, "").replace(",", "."));
/** The difference column is A − B of the displayed values, up to display rounding. */
async function assertDifference(metric, tolerance) {
  const [a, b, difference] = await Promise.all([text(`metric-${metric}`), text(`benchmark-${metric}`), text(`difference-${metric}`)]);
  assert.ok(Math.abs(number(difference) - (number(a) - number(b))) <= tolerance, `${metric}: ${difference} is A ${a} − B ${b}`);
}
const amount = () => page.getByRole("textbox", { name: "Počáteční částka", exact: true });
async function openQuiz() {
  const summary = page.getByText("Ověř si porozumění", { exact: true });
  if (!await summary.evaluate((element) => element.parentElement.open)) await summary.click();
}
async function settle() {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
}
async function layouts(state) {
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 }); await settle();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${state}: ${width}px overflow`);
    assert.equal(await page.locator("h1:visible").count(), 1);
    const nav = page.getByRole("navigation", { name: width < 1024 ? "Mobilní navigace" : "Hlavní navigace" });
    assert.equal(await nav.getByRole("link").count(), 3, "existing navigation preserved");
    assert.equal(await nav.locator('[aria-current="page"]').getAttribute("href"), "/lab");
    assert.ok(await page.locator("main").evaluate((element) => getComputedStyle(element).fontFamily.includes("Inter")), "Backtesting uses the shared Inter UI font");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${output}/${state}-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await settle();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${state}: 200% text overflow`);
  const clipped = await page.locator("main h1, main h2, main h3, main button, main label, main summary").evaluateAll((elements) => elements.filter((element) => element.clientWidth && element.scrollWidth > element.clientWidth + 2).map((element) => element.textContent));
  assert.deepEqual(clipped, [], `${state}: enlarged text clips`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}/${state}-320-text-200.png`, fullPage: true, animations: "disabled" });
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 1440, height: 900 });
}
async function financialState() {
  return {
    rewards: await sql`select lesson_id, practice_capital_minor from lesson_award where user_id = ${userId} order by lesson_id`,
    grants: await sql`select unlock_id, practice_capital_minor from progression_unlock where user_id = ${userId} order by unlock_id`,
    trades: await sql`select t.* from portfolio_trade t join portfolio p on p.id = t.portfolio_id where p.user_id = ${userId} order by t.id`,
    generations: await sql`select * from portfolio where user_id = ${userId} order by id`,
  };
}
try {
  await page.goto(`${baseURL}/sign-in`);
  await button("Vyzkoušet demo").click(); await page.waitForURL("**/learn");
  const session = await (await context.request.get(`${baseURL}/api/auth/get-session`)).json(); userId = session.user.id;
  const before = await financialState();
  // The Studovna link and Lab entry keep their existing destinations.
  await page.locator('a[href="/lab/backtesting"]').waitFor();
  await page.goto(`${baseURL}/lab/backtesting`); await amount().waitFor();
  assert.equal(await page.getByRole("combobox", { name: "Zvolená strategie" }).locator("option").count(), 3);
  assert.equal(await page.getByRole("region", { name: "Výsledek backtestu" }).count(), 0);
  await layouts("setup");
  await page.getByRole("radio", { name: "A Zvolená strategie", exact: true }).check();
  // Hold requestAnimationFrame briefly in this test to inspect the real loading state.
  await page.evaluate(() => { window.__originalRaf = window.requestAnimationFrame; window.requestAnimationFrame = (callback) => window.__originalRaf(() => setTimeout(() => callback(performance.now()), 100)); });
  await button("Spustit backtest").click();
  await page.getByRole("status").filter({ hasText: "Počítám obě cesty" }).waitFor();
  assert.equal(await amount().isDisabled(), true);
  assert.equal(await button("Počítám backtest…").isDisabled(), true);
  await page.evaluate(() => { window.requestAnimationFrame = window.__originalRaf; });
  await final().waitFor();
  assert.equal((await final().textContent()).replace(/\s/g, ""), "159732Kč");
  assert.equal(await page.getByRole("heading", { name: "Mix 60 / 30 / 10", exact: true }).evaluate((element) => element === document.activeElement), true);
  assert.ok(await page.getByText(/Tvůj tip byl A/).count() === 1);
  await page.locator(".recharts-surface").first().waitFor();
  await page.getByText("Zobrazit tabulku dat", { exact: true }).click();
  assert.equal(await page.getByRole("row").count(), 134);
  assert.match(await page.getByRole("row").nth(1).textContent(), /2014-12/);
  await page.getByText("Zobrazit tabulku dat", { exact: true }).click();
  const chart = page.locator(".recharts-surface").first();
  await chart.focus(); await chart.press("ArrowRight");
  await page.locator(".recharts-tooltip-wrapper").filter({ hasText: /2015|2014/ }).waitFor();
  await page.mouse.click(5, 5);
  await layouts("result");
  await openQuiz();
  await page.getByRole("radio", { name: "CAGR", exact: true }).check(); await button("Zkontrolovat odpověď").click();
  await page.getByRole("status").filter({ hasText: "Zaměř se na největší propad" }).waitFor();
  await button("Změnit nastavení").click();
  await page.waitForFunction(() => document.activeElement?.id === "strategy", undefined, { timeout: 15000 });
  assert.equal(await page.getByRole("combobox", { name: "Zvolená strategie" }).evaluate((element) => element === document.activeElement), true);
  for (const invalid of ["", "0", "-1", "NaN"]) {
    await amount().fill(invalid); await button("Spustit backtest").click(); await page.locator("main").getByRole("alert").waitFor();
    assert.equal((await final().textContent()).replace(/\s/g, ""), "159732Kč", "invalid rerun retains prior result");
  }
  await amount().fill("100000");
  await page.getByLabel("Od ledna", { exact: true }).selectOption("2025"); await page.getByLabel("Do prosince", { exact: true }).selectOption("2020");
  await button("Spustit backtest").click(); await page.getByRole("alert").filter({ hasText: "počáteční rok" }).waitFor();
  await page.getByLabel("Od ledna", { exact: true }).selectOption("2020");
  await button("Spustit backtest").click(); await page.getByText(/Leden 2020 – prosinec 2020/).waitFor();
  await settle();
  const shortTicks = await page.locator(".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value").allTextContents();
  assert.ok(shortTicks.length >= 3 && shortTicks.every((tick) => /^\d{1,2}\/\d{2}$/.test(tick)), `short-period month/year labels: ${JSON.stringify(shortTicks)}`);
  assert.equal(new Set(shortTicks).size, shortTicks.length, "no ambiguous duplicate years");
  assert.equal(await page.getByRole("status").filter({ hasText: "Vstupy se změnily" }).count(), 0);
  await openQuiz();
  await page.getByRole("radio", { name: "Největší propad", exact: true }).check(); await button("Zkontrolovat odpověď").click();
  await page.getByRole("status").filter({ hasText: "Správně." }).waitFor();
  // Changes in draft inputs must not leak into the snapshot used for comparisons.
  await button("Změnit nastavení").click(); await amount().fill("42");
  await page.getByRole("status").filter({ hasText: "Vstupy se změnily" }).waitFor();
  await button("Zavřít nastavení").click(); await button("Zkusit jiné období").click();
  await page.getByRole("heading", { name: "Stejný pokus, jiná období." }).waitFor();
  assert.match(await page.locator("main article").first().textContent(), /159\s*732/);
  assert.equal(await page.locator("main article").count(), 4);
  await settle();
  const compactTicks = await page.locator("main article").nth(2).locator(".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value").allTextContents();
  assert.ok(compactTicks.length >= 2 && compactTicks.every((tick) => tick.includes("/")), "compact one-year chart keeps months");
  await layouts("comparison");
  await button("Vybrat toto období").nth(2).click();
  assert.equal(await page.getByLabel("Od ledna", { exact: true }).inputValue(), "2022");
  assert.equal(await amount().inputValue(), "42", "draft amount preserved until explicitly submitted");
  await page.getByRole("combobox", { name: "Zvolená strategie" }).selectOption("stocks");
  await amount().fill("0.25"); await button("Spustit backtest").click();
  await page.getByRole("heading", { name: "Obě cesty skončily stejně." }).waitFor();
  assert.equal(await page.locator("main article").count(), 0, "rerun clears prior period comparisons");
  assert.match(await page.getByRole("region", { name: "Výsledek backtestu" }).textContent(), /B · Buy-and-hold akciového vzorku/);
  assert.equal(await text("difference-konečná-hodnota"), "0Kč", "the stock sample held as strategy equals its buy-and-hold benchmark");
  assert.equal(await text("difference-cagr"), "0p.b.");
  await button("Změnit nastavení").click();
  assert.equal(await button("Spustit backtest").evaluate((element) => getComputedStyle(element).transitionDuration), "0s");
  await page.getByRole("combobox", { name: "Zvolená strategie" }).selectOption("bonds"); await amount().fill("1.3333"); await button("Spustit backtest").click();
  await page.getByRole("heading", { name: "100 % dluhopisový vzorek", exact: true }).waitFor();

  // Price history through MarketDataService. Deterministic mode serves the invented SPX series, so it stays "Ukázková data".
  const strategySelect = page.getByRole("combobox", { name: "Zvolená strategie" });
  const sourceLabel = page.getByTestId("backtest-source-label");
  await button("Změnit nastavení").click();
  await page.getByRole("radio", { name: /Ukázková řada SPX/ }).check();
  assert.equal(await strategySelect.locator("option").count(), 2);
  assert.equal(await amount().inputValue(), "10000");
  assert.equal(await page.getByLabel("Od ledna", { exact: true }).inputValue(), "2016");
  assert.equal(await page.getByRole("combobox", { name: "Rebalancování" }).inputValue(), "annual");
  assert.match(await page.locator("#backtest-configuration").textContent(), /USD/);
  const benchmarkSelect = page.getByRole("combobox", { name: "Benchmark B · koupit a držet" });
  assert.deepEqual(await benchmarkSelect.locator("option").allTextContents(), ["Buy-and-hold SPX", "Buy-and-hold NVDA"]);
  assert.match(await page.locator("#backtest-configuration").textContent(), /Celá částka jednou koupí SPX \(Ukázková řada indexu S&P 500\) na začátku a drží ho\. Žádné rebalancování ani obchody\./);
  await button("Spustit backtest").click();
  await page.getByRole("heading", { name: "SPX 60 % + hotovost 40 %", exact: true }).waitFor();
  assert.equal((await final().textContent()).replace(/\s/g, ""), "13321$");
  assert.match(await sourceLabel.textContent(), /^\s*Ukázková data · ukázková řada SPX · 2016–2025$/);
  assert.equal(await page.locator("main").getByText("Historická data").count(), 0, "deterministic history is never labelled historical");
  assert.match(await page.getByRole("region", { name: "Výsledek backtestu" }).textContent(), /B · Buy-and-hold SPX/);
  for (const [metric, tolerance] of [["konečná-hodnota", 1], ["cagr", 0.011], ["největší-propad", 0.011], ["volatilita", 0.011]]) await assertDifference(metric, tolerance);
  const spxBenchmark = await text("benchmark-konečná-hodnota");
  // Another benchmark changes only path B: same months, amount, currency and price-only returns.
  await button("Změnit nastavení").click();
  await benchmarkSelect.selectOption("US-XNAS:NVDA");
  await page.getByRole("status").filter({ hasText: "Vstupy se změnily" }).waitFor();
  await page.getByRole("radio", { name: "B Buy-and-hold NVDA", exact: true }).check();
  await button("Spustit backtest").click();
  await page.getByText(/Tvůj tip byl B\./).waitFor();
  assert.equal((await final().textContent()).replace(/\s/g, ""), "13321$", "the strategy path does not depend on the benchmark");
  assert.notEqual(await text("benchmark-konečná-hodnota"), spxBenchmark);
  for (const [metric, tolerance] of [["konečná-hodnota", 1], ["cagr", 0.011], ["největší-propad", 0.011], ["volatilita", 0.011]]) await assertDifference(metric, tolerance);
  const nvdaResult = await page.getByRole("region", { name: "Výsledek backtestu" }).textContent();
  assert.match(nvdaResult, /B · Buy-and-hold NVDA/);
  assert.match(nvdaResult, /jiný instrument, NVDA/);
  assert.match(nvdaResult, /Tip se nehodnotí\./);
  assert.match(await sourceLabel.textContent(), /^\s*Ukázková data · ukázková řada SPX · 2016–2025$/);
  assert.equal(await page.locator("main").getByText("Historická data").count(), 0);
  await page.getByText("Zobrazit tabulku dat", { exact: true }).click();
  assert.equal(await page.getByRole("row").count(), 122, "the benchmark covers the same 120 months and start value");
  assert.match(await page.getByRole("row").first().textContent(), /B · Buy-and-hold NVDA/);
  await page.getByText("Zobrazit tabulku dat", { exact: true }).click();
  await layouts("history-benchmark");
  assert.match(await page.getByRole("region", { name: "Výsledek backtestu" }).textContent(), /9× vrátil k vahám 60 \/ 40/);
  await page.getByText("Zobrazit tabulku dat", { exact: true }).click();
  assert.equal(await page.getByRole("row").count(), 122, "120 monthly closes, the start value and the header");
  assert.match(await page.getByRole("row").nth(1).textContent(), /2015-12/);
  await page.getByText("Zobrazit tabulku dat", { exact: true }).click();
  await button("Změnit nastavení").click();
  await page.getByRole("combobox", { name: "Rebalancování" }).selectOption("monthly");
  await page.getByRole("status").filter({ hasText: "Vstupy se změnily" }).waitFor();
  await button("Spustit backtest").click();
  await page.getByText(/119× vrátil k vahám/).waitFor();
  assert.match(await page.getByRole("region", { name: "Výsledek backtestu" }).textContent(), /B · Buy-and-hold NVDA/, "the chosen benchmark stays selected");
  assert.equal((await final().textContent()).replace(/\s/g, ""), "13412$");
  await button("Změnit nastavení").click();
  await strategySelect.selectOption("trend-sma");
  assert.equal(await page.getByRole("combobox", { name: "Rebalancování" }).count(), 0, "a trend filter has no rebalancing rule");
  await page.getByLabel("Od ledna", { exact: true }).selectOption("2024"); await page.getByLabel("Do prosince", { exact: true }).selectOption("2018");
  await button("Spustit backtest").click(); await page.locator("main").getByRole("alert").filter({ hasText: "počáteční rok" }).waitFor();
  assert.equal((await final().textContent()).replace(/\s/g, ""), "13412$", "a refused history run keeps the previous result");
  await page.getByLabel("Od ledna", { exact: true }).selectOption("2016"); await page.getByLabel("Do prosince", { exact: true }).selectOption("2025");
  await button("Spustit backtest").click();
  await page.getByRole("heading", { name: "SPX s trendovým filtrem", exact: true }).waitFor();
  assert.equal((await final().textContent()).replace(/\s/g, ""), "13092$");
  await page.getByText(/Filtr držel SPX 83 z 120 měsíců a 21× přepnul/).waitFor();
  await button("Zkusit jiné období").click();
  await page.getByRole("heading", { name: "Stejný pokus, jiná období." }).waitFor();
  assert.equal(await page.locator("main article").count(), 4);
  assert.match(await page.locator("main article").first().textContent(), /Celá řada.*13\s092\s\$/s);
  assert.match(await page.locator("main article").first().textContent(), /B · Buy-and-hold NVDA/, "period comparisons keep the chosen benchmark");
  await layouts("history");

  assert.deepEqual(await financialState(), before, "backtests leave capital receipts, trades and generations unchanged");
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(`PASS: setup, loading, predictions, exact fixture, all monthly points, chart keyboard tooltip/table, invalid reruns, snapshots, comparisons, all strategies, decimal inputs, price-history runs (sample label, buy-and-hold benchmark choice and A − B differences, rebalancing, trend filter, refused input, period comparison), responsive widths/200% text, reduced motion, untouched portfolio. Screenshots: ${output}`);
} finally {
  await browser.close(); if (userId) await sql`delete from "user" where id = ${userId}`; await sql.end();
}
