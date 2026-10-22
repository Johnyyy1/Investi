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
  for (const width of [1440, 1024, 768, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 900 }); await settle();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${state}: ${width}px overflow`);
    assert.equal(await page.locator("h1:visible").count(), 1);
    if (state === "experiment-setup") {
      const columns = await page.locator('[class*="experimentFields"]').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
      assert.ok(columns <= 2, "experiment controls have at most two columns");
      if (width <= 390) assert.equal(columns, 1, "mobile experiment controls use one readable column");
    }
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
const simulation = () => page.getByRole("region", { name: "Co by mohlo nastat dál?" });
/** P5 … P95 at the horizon, in display order, must never cross. */
async function assertOrderedRange() {
  const [inner, median, outer] = await Promise.all([text("simulation-inner"), text("simulation-median"), text("simulation-outer")]);
  const [p25, p75] = inner.split("–").map(number), [p5, p95] = outer.split("–").map(number);
  assert.ok(p5 <= p25 && p25 <= number(median) && number(median) <= p75 && p75 <= p95, `ordered percentiles: ${outer} ⊇ ${inner} ∋ ${median}`);
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
  assert.equal(await page.getByRole("heading", { name: /Náklady obchodů/ }).count(), 0, "the synthetic sample has no cost model");
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

  // The simulation step: future paths drawn from A's 132 monthly returns, framed as uncertainty, not a forecast.
  assert.match(await simulation().textContent(), /Není to předpověď ani doporučení\. Rozsah ukazuje nejistotu\. Vychází jen z minulých dat a minulost se nemusí opakovat\./);
  assert.match(await simulation().textContent(), /132 měsíců, Mix 60 \/ 30 \/ 10/);
  assert.equal(await page.getByRole("textbox", { name: "Vklad na začátku" }).inputValue(), "100000");
  assert.equal(await page.getByRole("combobox", { name: "Horizont" }).inputValue(), "10");
  assert.equal(await simulation().getByText(/pravděpodobnost zisku/i).count(), 0, "no probability-of-profit metric");
  await button("Spustit simulaci").click();
  await page.getByTestId("simulation-result").waitFor();
  assert.equal(await page.getByRole("heading", { name: /^Za 10 let · start 100\s000\sKč$/ }).evaluate((element) => element === document.activeElement), true, "focus moves to the simulation result");
  assert.equal(await text("simulation-contributed"), "100000Kč");
  await assertOrderedRange();
  const fan = page.getByTestId("simulation-chart");
  await fan.locator(".recharts-surface").waitFor();
  assert.match(await fan.getByRole("img").getAttribute("aria-label"), /^Simulace 1\s000 cest\. Za 10 let je prostřední cesta \(medián\) .+ Polovina cest skončila mezi .+, 90 % cest mezi .+\. Vloženo celkem 100\s000\sKč\.$/);
  for (const label of ["P95", "P75", "Medián", "P25", "P5"]) assert.equal(await fan.locator("svg text").filter({ hasText: new RegExp(`^${label}$`) }).count(), 1, `in-chart label ${label}`);
  const median = await text("simulation-median");
  await button("Spustit znovu").click(); await settle();
  assert.equal(await text("simulation-median"), median, "the same settings and seed give the same paths");
  await button("Nové losování").click();
  await page.locator("main").getByText(/seed 20260202/).waitFor({ state: "attached" });
  await page.getByRole("combobox", { name: "Horizont" }).selectOption("20");
  await page.getByRole("textbox", { name: "Měsíční vklad" }).fill("1000");
  await simulation().getByRole("status").filter({ hasText: "Nastavení se změnilo" }).waitFor();
  await button("Spustit znovu").click();
  await page.getByRole("heading", { name: /^Za 20 let · start 100\s000\sKč \+ 1\s000\sKč měsíčně$/ }).waitFor();
  assert.equal(await text("simulation-contributed"), "340000Kč", "100 000 Kč plus 240 monthly contributions; deposits are not returns");
  await assertOrderedRange();
  await page.getByRole("textbox", { name: "Měsíční vklad" }).fill("-5"); await button("Spustit znovu").click();
  await simulation().getByRole("alert").filter({ hasText: "nesmí být záporný" }).waitFor();
  assert.equal(await text("simulation-contributed"), "340000Kč", "a refused simulation keeps the previous result");
  await page.getByRole("textbox", { name: "Měsíční vklad" }).fill("1000"); await button("Spustit znovu").click();
  await simulation().getByRole("alert").waitFor({ state: "detached" });
  await fan.getByText("Zobrazit tabulku dat", { exact: true }).click();
  assert.equal(await fan.getByRole("row").count(), 22, "the start, 20 year ends and the header");
  await fan.getByText("Zobrazit tabulku dat", { exact: true }).click();
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
  await button("Spustit backtest").click(); await page.getByText(/^Leden 2020 – prosinec 2020 · /).waitFor();
  await settle();
  const shortTicks = await page.locator(".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value").allTextContents();
  assert.ok(shortTicks.length >= 3 && shortTicks.every((tick) => /^\d{1,2}\/\d{2}$/.test(tick)), `short-period month/year labels: ${JSON.stringify(shortTicks)}`);
  assert.equal(new Set(shortTicks).size, shortTicks.length, "no ambiguous duplicate years");
  assert.equal(await page.getByRole("status").filter({ hasText: "Vstupy se změnily" }).count(), 0);
  await openQuiz();
  await page.getByRole("radio", { name: "Největší propad", exact: true }).check(); await button("Zkontrolovat odpověď").click();
  await page.getByRole("status").filter({ hasText: "Správně." }).waitFor();
  assert.match(await page.getByTestId("simulation-unavailable").textContent(), /alespoň 24 měsíců historie, tento backtest má 12/, "one year of returns is too short to simulate from");
  assert.equal(await button("Spustit simulaci").count(), 0);
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
  assert.equal(await text("difference-celkový-výnos"), "0p.b.");
  assert.equal(await text("difference-sharpeho-poměr"), "0,00");
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
  assert.equal(await page.getByRole("heading", { name: "5 · Náklady obchodů" }).count(), 1);
  assert.equal(await page.getByRole("radio", { name: /^Bez nákladů Obchody nic nestojí/ }).isChecked(), true, "costs are off until the learner switches them on");
  await button("Spustit backtest").click();
  await page.getByRole("heading", { name: "SPX 60 % + hotovost 40 %", exact: true }).waitFor();
  assert.equal((await final().textContent()).replace(/\s/g, ""), "13321$");
  assert.match(await sourceLabel.textContent(), /^\s*Ukázková data · ukázková řada SPX · 2016–2025$/);
  assert.equal(await page.locator("main").getByText("Historická data").count(), 0, "deterministic history is never labelled historical");
  assert.match(await page.getByRole("region", { name: "Výsledek backtestu" }).textContent(), /B · Buy-and-hold SPX/);
  for (const [metric, tolerance] of [["konečná-hodnota", 1], ["celkový-výnos", 0.011], ["cagr", 0.011], ["největší-propad", 0.011], ["volatilita", 0.011], ["sharpeho-poměr", 0.011]]) await assertDifference(metric, tolerance);
  const spxBenchmark = await text("benchmark-konečná-hodnota");
  // Total return is the whole-period change, not CAGR: 10 000 $ → 13 321 $ is +33,21 %.
  assert.equal(await text("metric-celkový-výnos"), "33,21%");
  assert.notEqual(await text("metric-celkový-výnos"), await text("metric-cagr"));
  assert.match(await text("metric-sharpeho-poměr"), /^-?\d+,\d{2}$/);
  await page.getByRole("link", { name: "Jak se počítá" }).click();
  assert.equal(await page.locator("#backtest-methodology").evaluate((element) => element.open), true, "the Sharpe row opens the methodology");
  assert.match(await page.locator("#backtest-methodology").textContent(), /Použitá sazba je 0\s%\sročně/);
  // Another benchmark changes only path B: same months, amount, currency and price-only returns.
  await button("Změnit nastavení").click();
  await benchmarkSelect.selectOption("US-XNAS:NVDA");
  await page.getByRole("status").filter({ hasText: "Vstupy se změnily" }).waitFor();
  await page.getByRole("radio", { name: "B Buy-and-hold NVDA", exact: true }).check();
  await button("Spustit backtest").click();
  await page.getByText(/Tvůj tip byl B\./).waitFor();
  assert.equal((await final().textContent()).replace(/\s/g, ""), "13321$", "the strategy path does not depend on the benchmark");
  assert.notEqual(await text("benchmark-konečná-hodnota"), spxBenchmark);
  for (const [metric, tolerance] of [["konečná-hodnota", 1], ["celkový-výnos", 0.011], ["cagr", 0.011], ["největší-propad", 0.011], ["volatilita", 0.011], ["sharpeho-poměr", 0.011]]) await assertDifference(metric, tolerance);
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

  // Transaction costs: switched on, the run is compared with the same closes without costs.
  await button("Změnit nastavení").click();
  await strategySelect.selectOption("mix-60-40");
  await page.getByRole("combobox", { name: "Rebalancování" }).selectOption("monthly");
  await page.getByRole("radio", { name: /^Započítat náklady/ }).check();
  const rate = page.getByRole("textbox", { name: "Poplatek z objemu obchodu" });
  const fee = page.getByRole("textbox", { name: "Fixní poplatek za obchod" });
  assert.equal(await rate.inputValue(), "0,1");
  assert.equal(await fee.inputValue(), "0");
  await rate.fill("0,125"); await button("Spustit backtest").click();
  await page.locator("main").getByRole("alert").filter({ hasText: "dvě desetinná místa" }).waitFor();
  assert.equal((await final().textContent()).replace(/\s/g, ""), "13092$", "a refused cost input keeps the previous result");
  await rate.fill("0,25"); await fee.fill("1"); await button("Spustit backtest").click();
  await page.getByRole("heading", { name: "Co stály náklady" }).waitFor();
  const withCosts = number(await text("metric-konečná-hodnota"));
  assert.ok(withCosts < 13412, `costs lower the final value: ${withCosts}`);
  assert.equal(await text("cost-trades"), "120", "the purchase and 119 monthly rebalances");
  assert.equal(await text("cost-benchmark-trades"), "1", "buy and hold pays only for its purchase");
  const headline = await page.getByTestId("cost-headline").textContent();
  assert.match(headline, /^Náklady tě u strategie A stály [\d\s,]+\s\$ \([\d,]+\sp\.\sb\. ročně\)\.$/);
  assert.ok(Math.abs(number(headline.split("stály")[1].split("$")[0]) - (13412 - withCosts)) <= 1, `headline is the final-value difference: ${headline}`);
  assert.match(await text("cost-final-value"), /^-/);
  assert.match(await text("cost-cagr"), /^-[\d,]+p\.b\.$/);
  assert.match(await page.locator(".recharts-surface").first().locator("xpath=ancestor::figure").textContent(), /náklady 0,25\s%\sz hodnoty obchodu \+ 1\s\$ za obchod/);
  const view = (name) => page.getByRole("group", { name: "Zobrazit výsledek" }).getByRole("radio", { name });
  assert.equal(await view(/^S náklady/).isChecked(), true);
  await view(/^Bez nákladů/).check();
  assert.equal((await final().textContent()).replace(/\s/g, ""), "13412$", "the view without costs is the earlier run without them");
  assert.match(await page.locator(".recharts-surface").first().locator("xpath=ancestor::figure").textContent(), /bez poplatků a daní/);
  assert.equal(await page.getByRole("heading", { name: "Co stály náklady" }).count(), 1, "the cost summary stays in both views");
  await view(/^S náklady/).check();
  assert.equal(number(await text("metric-konečná-hodnota")), withCosts);
  // The simulation draws from the shown run, so switching the cost view starts it afresh.
  assert.match(await simulation().textContent(), /120 měsíců, SPX 60 % \+ hotovost 40 % · .+ · s náklady obchodů/);
  await button("Spustit simulaci").click();
  await page.getByRole("heading", { name: /^Za 10 let · start 10\s000\s\$$/ }).waitFor();
  assert.match(await page.getByTestId("simulation-chart").textContent(), /Simulace · Ukázková data/, "the simulation keeps the backtest's sample label");
  await assertOrderedRange();
  await view(/^Bez nákladů/).check();
  assert.equal(await page.getByTestId("simulation-result").count(), 0);
  assert.match(await simulation().textContent(), /bez nákladů obchodů/);
  await view(/^S náklady/).check();
  await layouts("costs");
  await button("Změnit nastavení").click();
  await page.getByRole("radio", { name: /^Bez nákladů Obchody nic nestojí/ }).check();
  await page.getByRole("status").filter({ hasText: "Vstupy se změnily" }).waitFor();
  await button("Spustit backtest").click();
  await page.getByRole("heading", { name: "Co stály náklady" }).waitFor({ state: "detached" });
  assert.equal((await final().textContent()).replace(/\s/g, ""), "13412$", "switching costs off restores the run without them");
  assert.equal(await page.getByRole("group", { name: "Zobrazit výsledek" }).count(), 0);

  // Educational experiments keep cash flows separate from performance and preserve holdout state.
  await button("Změnit nastavení").click();
  await page.getByLabel("Cíl pokusu", { exact: true }).selectOption("timing");
  const experimentSummary = page.getByText("Vklady, čerpání a ověření strategie", { exact: true });
  await experimentSummary.focus();
  await experimentSummary.press("Enter");
  const monthlyContribution = page.getByRole("textbox", { name: "Měsíční příspěvek v backtestu", exact: true });
  const fundCost = page.getByRole("textbox", { name: "Roční nákladovost fondu", exact: true });
  await monthlyContribution.fill("100");
  await page.getByLabel("Rozložení počáteční částky", { exact: true }).selectOption("12");
  await fundCost.fill("0,25");
  await page.getByRole("textbox", { name: "Měsíční výběr", exact: true }).fill("25");
  await page.getByLabel("Out-of-sample od ledna", { exact: true }).selectOption("2021");
  await layouts("experiment-setup");
  await button("Spustit backtest").click();
  await page.getByRole("heading", { name: "Vklady nejsou výnos", exact: true }).waitFor();
  assert.equal(await text("flow-contributed"), "22000$");
  assert.equal(await text("flow-withdrawn"), "3000$");
  assert.equal(await text("flow-unfundedWithdrawals"), "0$");
  assert.equal(await page.getByTestId("metric-cagr").count(), 0, "no naive CAGR with flows");
  assert.ok(await page.getByTestId("metric-twr-za-období").count());
  assert.ok(await page.getByTestId("metric-mwr-ročně").count());
  assert.match(await page.getByTestId("split-inSample").textContent(), /2016-01 – 2020-12 · 60 měsíců/);
  assert.match(await page.getByTestId("split-outOfSample").textContent(), /2021-01 – 2025-12 · 60 měsíců/);
  assert.match(await page.getByTestId("attempt-counter").textContent(), /relaci: 1/);
  const netWithCosts = await text("metric-konečná-hodnota");
  await view(/^Bez nákladů/).check();
  assert.notEqual(await text("metric-konečná-hodnota"), netWithCosts);
  assert.equal(await text("flow-fundCosts"), "0$");
  await view(/^S náklady/).check();
  await layouts("experiments");
  await button("Změnit nastavení").click();
  await button("Spustit backtest").click();
  await page.getByRole("heading", { name: "Vklady nejsou výnos", exact: true }).waitFor();
  assert.match(await page.getByTestId("attempt-counter").textContent(), /relaci: 1/, "an identical rerun is not a new attempt");
  for (const value of ["101", "102", "103", "104"]) {
    await button("Změnit nastavení").click();
    await monthlyContribution.fill(value);
    await button("Spustit backtest").click();
    await page.waitForFunction((expected) => document.querySelector('[data-testid="flow-contributed"]')?.textContent.replace(/\s/g, "") === `${expected}$`, 10000 + 120 * Number(value));
    await page.getByRole("button", { name: "Změnit nastavení", exact: true }).waitFor();
  }
  await page.getByTestId("overfitting-notice").waitFor();
  assert.match(await page.getByTestId("attempt-counter").textContent(), /relaci: 5/);
  await page.reload();
  await page.getByLabel("Cíl pokusu", { exact: true }).selectOption("timing");
  await page.getByTestId("overfitting-notice").waitFor();
  assert.match(await page.getByTestId("attempt-counter").textContent(), /relaci: 5/, "tab session survives reload");
  await page.getByLabel("Cíl pokusu", { exact: true }).selectOption("withdrawals");
  assert.match(await page.getByTestId("attempt-counter").textContent(), /relaci: 0/, "a different objective has its own counter");

  assert.deepEqual(await financialState(), before, "backtests leave capital receipts, trades and generations unchanged");
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(`PASS: educational contributions/withdrawals/fund costs, TWR/MWR, continuous holdout, per-goal attempt counter/retry/reload, overfitting notice; setup, loading, predictions, exact fixture, all monthly points, chart keyboard tooltip/table, invalid reruns, snapshots, comparisons, all strategies, decimal inputs, price-history runs (sample label, buy-and-hold benchmark choice and A − B differences, rebalancing, trend filter, refused input, period comparison, transaction costs on/off and the with/without-costs view), simulation step (framing, focus, ordered percentiles, in-chart labels, same seed same result, redraw, contributions, refused input, table, too-short history, cost view reset), responsive widths/200% text, reduced motion, untouched portfolio. Screenshots: ${output}`);
} finally {
  await browser.close(); if (userId) await sql`delete from "user" where id = ${userId}`; await sql.end();
}
